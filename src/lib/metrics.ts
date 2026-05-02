/**
 * In-process observability for a small (3-4 customer) deployment. No
 * Datadog, no Prometheus, no OTLP — just enough state held in memory so
 * an admin can answer:
 *
 *   - Are we serving requests? At what latency?
 *   - Did anything error in the last hour?
 *   - Are crons running on schedule?
 *   - Is the queue draining?
 *
 * Persistence model: pure in-memory. Snapshots reset on process restart;
 * for the deploy footprint (single Node process behind a Cloudflare tunnel
 * with daily Postgres backup) that's the right tradeoff. Anything we'd
 * want to keep after a crash already lives in AuditEvent / WebhookDelivery /
 * ErrorLog (DB-backed) or the structured log stream.
 *
 * Hot loop: every API request flows through observe() in middleware. Keep
 * this allocation-free in the success path — the ring buffers are
 * fixed-size arrays with a pointer.
 */

const REQUEST_RING_SIZE = 500;
const ERROR_RING_SIZE = 100;
const SLOW_REQUEST_THRESHOLD_MS = 1000;

export type RequestSample = {
  t: number;          // epoch ms
  method: string;
  path: string;       // route segment with params normalized to :id
  status: number;
  ms: number;
  tenantId?: string;
  userId?: string;
};

export type ErrorSample = {
  t: number;
  module: string;
  message: string;
  path?: string;
  tenantId?: string;
  stack?: string;
};

export type CronRunSample = {
  name: string;
  startedAt: number;
  finishedAt: number;
  ok: boolean;
  message?: string;
};

const requestRing: (RequestSample | null)[] = new Array(REQUEST_RING_SIZE).fill(null);
let requestCursor = 0;

const errorRing: (ErrorSample | null)[] = new Array(ERROR_RING_SIZE).fill(null);
let errorCursor = 0;

const cronLastRun = new Map<string, CronRunSample>();

// Keep a per-route counter so we can compute p50/p95 without holding every sample.
type RouteAggregate = {
  count: number;
  errorCount: number;
  totalMs: number;
  // Reservoir for percentile estimation. Bounded so a chatty route
  // doesn't grow without limit. 50 samples gives reasonable p50/p95.
  reservoir: number[];
};
const routeAggregates = new Map<string, RouteAggregate>();
const RESERVOIR_CAP = 50;

/**
 * Normalize a request path so /projects/abc123 and /projects/def456 both
 * roll up under /projects/:id. Otherwise the per-route table grows
 * unbounded with cuid-shaped segments.
 */
export function normalizePath(path: string): string {
  // Strip query string
  const q = path.indexOf("?");
  const p = q >= 0 ? path.slice(0, q) : path;
  return p
    .split("/")
    .map((seg) => {
      if (!seg) return seg;
      // cuid (starts with 'c', 25 chars, alphanumeric) or UUID
      if (/^c[a-z0-9]{24}$/.test(seg)) return ":id";
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg)) return ":id";
      // Long opaque slug (likely an id)
      if (seg.length > 20 && /^[A-Za-z0-9_-]+$/.test(seg)) return ":id";
      return seg;
    })
    .join("/");
}

/** Record a request that has finished. Called from middleware afterResponse. */
export function observeRequest(sample: RequestSample): void {
  requestRing[requestCursor] = sample;
  requestCursor = (requestCursor + 1) % REQUEST_RING_SIZE;

  const key = `${sample.method} ${sample.path}`;
  let agg = routeAggregates.get(key);
  if (!agg) {
    agg = { count: 0, errorCount: 0, totalMs: 0, reservoir: [] };
    routeAggregates.set(key, agg);
  }
  agg.count += 1;
  agg.totalMs += sample.ms;
  if (sample.status >= 500) agg.errorCount += 1;
  if (agg.reservoir.length < RESERVOIR_CAP) {
    agg.reservoir.push(sample.ms);
  } else {
    // Reservoir sampling: replace at random with prob CAP/count
    const r = Math.floor(Math.random() * agg.count);
    if (r < RESERVOIR_CAP) agg.reservoir[r] = sample.ms;
  }
}

/** Record an error. Called from captureException in lib/log.ts. */
export function observeError(sample: ErrorSample): void {
  errorRing[errorCursor] = sample;
  errorCursor = (errorCursor + 1) % ERROR_RING_SIZE;
}

/** Mark a cron run start/finish. Called from the cron route handlers. */
export function observeCronRun(sample: CronRunSample): void {
  cronLastRun.set(sample.name, sample);
}

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.floor((sortedAsc.length - 1) * p));
  return sortedAsc[idx]!;
}

export type Snapshot = {
  generatedAt: number;
  windowMs: number;
  totalRequests: number;
  errorCount: number;
  errorRate: number;
  slowCount: number;
  p50Ms: number;
  p95Ms: number;
  perRoute: Array<{
    route: string;
    count: number;
    errorCount: number;
    avgMs: number;
    p50Ms: number;
    p95Ms: number;
  }>;
  recentErrors: ErrorSample[];
  recentSlow: RequestSample[];
  cronRuns: CronRunSample[];
};

/** Build a snapshot of the current observability state. Cheap to call. */
export function snapshot(windowMs: number = 60 * 60 * 1000): Snapshot {
  const now = Date.now();
  const cutoff = now - windowMs;

  // Walk the request ring once, computing global + per-route stats.
  const recentRequests: RequestSample[] = [];
  for (const r of requestRing) {
    if (r && r.t >= cutoff) recentRequests.push(r);
  }
  const total = recentRequests.length;
  const errors = recentRequests.filter((r) => r.status >= 500).length;
  const slow = recentRequests.filter((r) => r.ms >= SLOW_REQUEST_THRESHOLD_MS);
  const allMs = recentRequests.map((r) => r.ms).sort((a, b) => a - b);

  // Group by route for the table.
  const byRoute = new Map<string, RequestSample[]>();
  for (const r of recentRequests) {
    const key = `${r.method} ${r.path}`;
    let bucket = byRoute.get(key);
    if (!bucket) { bucket = []; byRoute.set(key, bucket); }
    bucket.push(r);
  }
  const perRoute = Array.from(byRoute.entries())
    .map(([route, samples]) => {
      const ms = samples.map((s) => s.ms).sort((a, b) => a - b);
      const sumMs = ms.reduce((s, x) => s + x, 0);
      return {
        route,
        count: samples.length,
        errorCount: samples.filter((s) => s.status >= 500).length,
        avgMs: Math.round(sumMs / samples.length),
        p50Ms: percentile(ms, 0.5),
        p95Ms: percentile(ms, 0.95),
      };
    })
    .sort((a, b) => b.count - a.count);

  const recentErrors: ErrorSample[] = [];
  for (const e of errorRing) {
    if (e && e.t >= cutoff) recentErrors.push(e);
  }
  recentErrors.sort((a, b) => b.t - a.t);

  return {
    generatedAt: now,
    windowMs,
    totalRequests: total,
    errorCount: errors,
    errorRate: total === 0 ? 0 : errors / total,
    slowCount: slow.length,
    p50Ms: percentile(allMs, 0.5),
    p95Ms: percentile(allMs, 0.95),
    perRoute,
    recentErrors: recentErrors.slice(0, 20),
    recentSlow: slow.sort((a, b) => b.ms - a.ms).slice(0, 20),
    cronRuns: Array.from(cronLastRun.values()).sort((a, b) => b.startedAt - a.startedAt),
  };
}

/** Reset all in-memory state. Used by tests. */
export function __resetForTest(): void {
  for (let i = 0; i < REQUEST_RING_SIZE; i++) requestRing[i] = null;
  for (let i = 0; i < ERROR_RING_SIZE; i++) errorRing[i] = null;
  requestCursor = 0;
  errorCursor = 0;
  routeAggregates.clear();
  cronLastRun.clear();
}
