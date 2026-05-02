import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { currentSuperAdmin } from "@/lib/permissions";
import { verifyAllPortals } from "@/lib/portal-verify";

/**
 * Super-admin-triggered synchronous portal verification. Used by the
 * "Refresh now" button on /admin/portal-coverage when ops staff want
 * fresh telemetry without waiting for the cron.
 *
 * Sync rather than fire-and-forget so the redirect lands on a page
 * that already reflects the new state. A full pass takes a few
 * minutes; the user's HTTP timeout is the limiting factor.
 *
 * Not auditable in tenant-scoped AuditEvent (tenantId is required) —
 * platform-level actions are tracked via server logs only for now.
 */
export async function POST() {
  const admin = await currentSuperAdmin();
  if (!admin) return NextResponse.json({ error: "super admin required" }, { status: 403 });

  const result = await verifyAllPortals();
  console.log(`[admin/verify-portals] ${admin.email ?? admin.userId} ran verification — ${result.passing}/${result.rowsProbed} passing in ${result.durationMs}ms`);
  redirect("/admin/portal-coverage?refreshed=1");
}
