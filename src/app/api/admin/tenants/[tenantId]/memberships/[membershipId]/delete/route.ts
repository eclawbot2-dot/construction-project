import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/permissions";
import { publicRedirect } from "@/lib/redirect";

export async function POST(req: Request, ctx: { params: Promise<{ tenantId: string; membershipId: string }> }) {
  const admin = await requireSuperAdmin();
  const { tenantId, membershipId } = await ctx.params;
  await prisma.membership.delete({ where: { id: membershipId } }).catch(() => null);
  await prisma.auditEvent.create({
    data: { tenantId, actorId: admin.userId, entityType: "Membership", entityId: membershipId, action: "MEMBERSHIP_REMOVED", source: "admin/member-delete" },
  });
  return publicRedirect(req, `/admin/tenants/${tenantId}`, 303);
}
