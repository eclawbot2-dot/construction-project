/**
 * Structured logging facade. Drops to console in dev; can be wired to
 * pino / Datadog / Sentry transport in production by setting LOG_SINK.
 *
 * Always emits JSON-shape lines so log aggregators (CloudWatch, Loki,
 * Datadog) can parse the structure. Includes tenantId, actorId, and a
 * request-id when caller supplies them — those are the three fields
 * we filter by in incident response.
 */

import { observeError } from "@/lib/metrics";

type LogLevel = "debug" | "info" | "warn" | "error";

type LogContext = {
  tenantId?: string | null;
  actorId?: string | null;
  requestId?: string | null;
  module?: string;
  [k: string]: unknown;
};

function emit(level: LogLevel, message: string, ctx?: LogContext, err?: unknown) {
  const entry: Record<string, unknown> = {
    t: new Date().toISOString(),
    level,
    message,
    ...(ctx ?? {}),
  };
  if (err) {
    entry.error = err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : String(err);
  }
  // In dev, emit a readable line. In prod, emit JSON.
  if (process.env.NODE_ENV !== "production") {
    const c = level === "error" ? "\x1b[31m" : level === "warn" ? "\x1b[33m" : level === "info" ? "\x1b[36m" : "\x1b[90m";
    const r = "\x1b[0m";
    const tag = ctx?.module ? `[${ctx.module}]` : "";
    console[level === "debug" ? "log" : level](`${c}${level.toUpperCase()}${r} ${tag} ${message}`, ctx ?? "", err ?? "");
  } else {
    process.stdout.write(JSON.stringify(entry) + "\n");
  }
}

export const log = {
  debug: (m: string, ctx?: LogContext) => emit("debug", m, ctx),
  info: (m: string, ctx?: LogContext) => emit("info", m, ctx),
  warn: (m: string, ctx?: LogContext, err?: unknown) => emit("warn", m, ctx, err),
  error: (m: string, ctx?: LogContext, err?: unknown) => emit("error", m, ctx, err),
};

/**
 * Capture an exception + ship to Sentry if SENTRY_DSN is set. Cheap
 * polyfill so we don't take a hard dependency on @sentry/node — a real
 * Sentry SDK can replace this when the operator wants it.
 */
export function captureException(err: unknown, ctx?: LogContext) {
  log.error(err instanceof Error ? err.message : "exception", ctx, err);
  // Push into the in-memory ring buffer so the /settings/observability
  // page can surface recent errors without a Sentry dependency.
  observeError({
    t: Date.now(),
    module: ctx?.module ?? "unknown",
    message: err instanceof Error ? err.message : String(err),
    path: typeof ctx?.path === "string" ? ctx.path : undefined,
    tenantId: ctx?.tenantId ?? undefined,
    stack: err instanceof Error ? err.stack : undefined,
  });
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  // Lazy non-blocking POST — best-effort. Don't await; don't throw.
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace(/^\//, "");
    const auth = url.username;
    const endpoint = `${url.protocol}//${url.host}/api/${projectId}/store/`;
    const payload = {
      message: err instanceof Error ? err.message : String(err),
      level: "error",
      timestamp: Math.floor(Date.now() / 1000),
      exception: err instanceof Error ? { values: [{ type: err.name, value: err.message, stacktrace: { frames: [] } }] } : undefined,
      tags: ctx,
    };
    fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-sentry-auth": `Sentry sentry_version=7, sentry_key=${auth}, sentry_client=bcon/1.0`,
      },
      body: JSON.stringify(payload),
    }).catch(() => { /* sentry transport best-effort */ });
  } catch {
    /* DSN parse failed; ignore */
  }
}
