import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/permissions";
import { publicRedirect } from "@/lib/redirect";

export async function POST(req: Request, ctx: { params: Promise<{ tenantId: string }> }) {
  const admin = await requireSuperAdmin();
  const { tenantId } = await ctx.params;
  const form = await req.formData();
  const confirm = String(form.get("confirm") ?? "").trim();
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (confirm !== tenant.slug) return NextResponse.json({ error: `Confirmation must match slug "${tenant.slug}".` }, { status: 400 });
  await prisma.auditEvent.create({
    data: { tenantId, actorId: admin.userId, entityType: "Tenant", entityId: tenantId, action: "TENANT_DELETED", beforeJson: JSON.stringify({ name: tenant.name, slug: tenant.slug }), source: "admin/delete" },
  });
  await prisma.tenant.delete({ where: { id: tenantId } });
  return publicRedirect(req, `/admin/tenants`, 303);
}
