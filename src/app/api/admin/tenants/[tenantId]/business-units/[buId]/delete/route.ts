import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/permissions";
import { publicRedirect } from "@/lib/redirect";

export async function POST(req: Request, ctx: { params: Promise<{ tenantId: string; buId: string }> }) {
  const admin = await requireSuperAdmin();
  const { tenantId, buId } = await ctx.params;
  await prisma.businessUnit.delete({ where: { id: buId } }).catch(() => null);
  await prisma.auditEvent.create({
    data: { tenantId, actorId: admin.userId, entityType: "BusinessUnit", entityId: buId, action: "BUSINESS_UNIT_DELETED", source: "admin/bu-delete" },
  });
  return publicRedirect(req, `/admin/tenants/${tenantId}`, 303);
}
