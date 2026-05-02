import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Audit-event retention cron. Deletes AuditEvent rows older than 365
 * days. Compliance + DB hygiene — without this, the audit table grows
 * without bound and slow-paths the /admin/audit and /settings/audit
 * pages over time.
 *
 * Auth: bearer CRON_SECRET, same pattern as /api/cron/backup.
 *
 * Configurable retention via ?days=N query param (caller can request
 * a longer hold for a specific compliance window). Floor 30 days so
 * a misconfigured cron can't accidentally wipe recent activity.
 */

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

function authorize(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "Cron not configured" }, { status: 503 });
  const header = req.headers.get("authorization") ?? "";
  if (!timingSafeEqual(header, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function POST(req: NextRequest) {
  const denied = authorize(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const requested = Number(url.searchParams.get("days") ?? "365");
  const days = Number.isFinite(requested) ? Math.max(30, Math.floor(requested)) : 365;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const result = await prisma.auditEvent.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return NextResponse.json({
    ok: true,
    cutoff: cutoff.toISOString(),
    retentionDays: days,
    deleted: result.count,
  });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
