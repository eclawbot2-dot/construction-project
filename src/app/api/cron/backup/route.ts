import { NextRequest, NextResponse } from "next/server";
import { backupAllTenants } from "@/lib/backup";

/**
 * Nightly backup endpoint — intended to be hit by Windows Task Scheduler
 * (or any external scheduler) once per day. The host's OneDrive / Google
 * Drive desktop client is expected to be syncing the `./uploads/backups/`
 * directory and any per-tenant `tenant.backupDirectory` paths.
 *
 * Auth identical to /api/cron/rfp-sweep: bearer token via CRON_SECRET.
 * The middleware excludes /api/cron/* from session-based auth.
 */

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

function authorize(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/backup] CRON_SECRET not configured");
    return NextResponse.json({ error: "Cron not configured" }, { status: 503 });
  }
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (!timingSafeEqual(header, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function POST(req: NextRequest) {
  const denied = authorize(req);
  if (denied) return denied;
  const start = Date.now();
  const results = await backupAllTenants();
  const ok = results.filter((r) => r.ok).length;
  const failed = results.length - ok;
  return NextResponse.json({
    ok: failed === 0,
    durationMs: Date.now() - start,
    tenantCount: results.length,
    succeeded: ok,
    failed,
    results,
  });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
