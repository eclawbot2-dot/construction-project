import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { llmProvider } from "@/lib/ai";

/**
 * Health endpoint for the Cloudflare tunnel + monitoring tools. Excluded
 * from session auth in middleware so probes work without a cookie.
 *
 * Returns 200 with a JSON status object. Slow / DB-broken / mis-configured
 * deploys still return 200 with the failing components flagged so a
 * monitoring tool can render a single-tenant uptime dashboard. If you
 * want a hard 503 on degradation, use /api/health?strict=1 — that flips
 * the status code to 503 when any component is down.
 */
export async function GET(req: Request) {
  const start = Date.now();
  const url = new URL(req.url);
  const strict = url.searchParams.get("strict") === "1";

  let dbOk = true;
  let dbLatencyMs = 0;
  let dbError: string | null = null;
  try {
    const t0 = Date.now();
    // Cheapest possible probe — counts a tiny system table that always exists.
    await prisma.tenant.count();
    dbLatencyMs = Date.now() - t0;
  } catch (err) {
    dbOk = false;
    dbError = err instanceof Error ? err.message : String(err);
  }

  const auth = {
    secretConfigured: !!process.env.AUTH_SECRET,
    trustHost: process.env.AUTH_TRUST_HOST === "true",
  };
  const cron = { secretConfigured: !!process.env.CRON_SECRET };
  const llm = { provider: llmProvider() };
  const queue = { transport: process.env.QUEUE_TRANSPORT ?? "in-process" };
  const storage = { transport: process.env.STORAGE_TRANSPORT ?? "local" };
  const notify = { transport: process.env.NOTIFY_TRANSPORT ?? "console" };

  const allOk = dbOk && auth.secretConfigured;

  const body = {
    ok: allOk,
    uptime: process.uptime(),
    durationMs: Date.now() - start,
    db: { ok: dbOk, latencyMs: dbLatencyMs, error: dbError },
    auth,
    cron,
    llm,
    queue,
    storage,
    notify,
    nodeEnv: process.env.NODE_ENV ?? "development",
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(body, { status: strict && !allOk ? 503 : 200 });
}
