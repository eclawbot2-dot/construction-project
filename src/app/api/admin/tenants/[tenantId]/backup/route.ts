import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { backupTenant } from "@/lib/backup";
import { publicRedirect } from "@/lib/redirect";
import { parseStringField } from "@/lib/form-input";

/**
 * Super-admin endpoint to (a) configure a tenant's backup settings and
 * (b) trigger a one-shot backup right now. Both actions land here so the
 * /admin/tenants/[id] page only needs one form-target.
 *
 * action=config   → update backupEnabled / backupDirectory
 * action=run      → run backupTenant() immediately, return result
 */
export async function POST(req: Request, ctx: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await ctx.params;
  const admin = await requireSuperAdmin();

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) return NextResponse.json({ error: "tenant not found" }, { status: 404 });

  const form = await req.formData();
  const action = String(form.get("action") ?? "config");

  if (action === "run") {
    const result = await backupTenant(tenantId);
    await recordAudit({
      tenantId,
      actorId: admin.userId,
      actorName: admin.name,
      entityType: "Tenant",
      entityId: tenantId,
      action: "BACKUP_RUN",
      after: { ok: result.ok, bytes: result.bytes ?? null, error: result.error ?? null },
      source: "admin/tenants/backup/run",
    });
    return publicRedirect(req, `/admin/tenants/${tenantId}`, 303);
  }

  // config path
  const backupEnabled = form.get("backupEnabled") === "on";
  const backupDirectory = parseStringField(form.get("backupDirectory"), null);

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { backupEnabled, backupDirectory },
  });

  await recordAudit({
    tenantId,
    actorId: admin.userId,
    actorName: admin.name,
    entityType: "Tenant",
    entityId: tenantId,
    action: "BACKUP_CONFIG",
    before: { backupEnabled: tenant.backupEnabled, backupDirectory: tenant.backupDirectory },
    after: { backupEnabled, backupDirectory },
    source: "admin/tenants/backup/config",
  });

  return publicRedirect(req, `/admin/tenants/${tenantId}`, 303);
}
