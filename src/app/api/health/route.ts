import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { llmProvider } from "@/lib/ai";
import { consumeRateLimit } from "@/lib/rate-limit";

/**
 * Health endpoint for the Cloudflare tunnel + monitoring tools. Excluded
 * from session auth in middleware so probes work without a cookie.
 *
 * Two response shapes:
 *   - default (no auth header): minimal `{ ok, timestamp }`. Suitable
 *     for HEAD/GET probes from PagerDuty / Healthchecks.io / etc.
 *     Doesn't fingerprint the deployment to anonymous callers (pass-10
 *     flagged the previous version as leaking queue/storage/notify
 *     transports).
 *   - with `Authorization: Bearer <CRON_SECRET>` header: full diagnostic
 *     payload including db latency, transport choices, llm provider.
 *
 * `?strict=1` flips the status code to 503 when any component is down,
 * for monitoring tools that expect a hard signal.
 */
export async function GET(req: Request) {
  const start = Date.now();
  const url = new URL(req.url);
  const strict = url.searchParams.get("strict") === "1";

  // Rate-limit anonymous probes so a malicious caller can't hammer the
  // DB count() in a tight loop. Authenticated callers (with the cron
  // bearer) bypass — monitoring tools may legitimately probe every 30s.
  const authHeader = req.headers.get("authorization") ?? "";
  const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : null;
  const elevated = expected != null && authHeader === expected;
  if (!elevated) {
    const ip = req.headers.get("cf-connecting-ip")
      ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? "?";
    const rl = consumeRateLimit(`health:${ip}`, { limit: 60, windowMs: 60_000 });
    if (!rl.allowed) {
      return NextResponse.json({ error: "rate limited" }, { status: 429 });
    }
  }

  let dbOk = true;
  let dbLatencyMs = 0;
  let dbError: string | null = null;
  try {
    const t0 = Date.now();
    await prisma.tenant.count();
    dbLatencyMs = Date.now() - t0;
  } catch (err) {
    dbOk = false;
    dbError = err instanceof Error ? err.message : String(err);
  }

  const allOk = dbOk && !!process.env.AUTH_SECRET;

  if (!elevated) {
    // Minimal public response — caller knows whether the tunnel is up
    // and the DB is reachable, nothing else.
    return NextResponse.json(
      {
        ok: allOk,
        db: dbOk,
        timestamp: new Date().toISOString(),
      },
      { status: strict && !allOk ? 503 : 200 },
    );
  }

  return NextResponse.json(
    {
      ok: allOk,
      uptime: process.uptime(),
      durationMs: Date.now() - start,
      db: { ok: dbOk, latencyMs: dbLatencyMs, error: dbError },
      auth: {
        secretConfigured: !!process.env.AUTH_SECRET,
        trustHost: process.env.AUTH_TRUST_HOST === "true",
      },
      cron: { secretConfigured: !!process.env.CRON_SECRET },
      llm: { provider: llmProvider() },
      queue: { transport: process.env.QUEUE_TRANSPORT ?? "in-process" },
      storage: { transport: process.env.STORAGE_TRANSPORT ?? "local" },
      notify: { transport: process.env.NOTIFY_TRANSPORT ?? "console" },
      nodeEnv: process.env.NODE_ENV ?? "development",
      timestamp: new Date().toISOString(),
    },
    { status: strict && !allOk ? 503 : 200 },
  );
}
