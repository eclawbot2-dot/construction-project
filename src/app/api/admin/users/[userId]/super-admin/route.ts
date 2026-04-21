import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/permissions";
import { publicRedirect } from "@/lib/redirect";

export async function POST(req: Request, ctx: { params: Promise<{ userId: string }> }) {
  const admin = await requireSuperAdmin();
  const { userId } = await ctx.params;
  const form = await req.formData();
  const superAdmin = String(form.get("superAdmin") ?? "0") === "1";
  await prisma.user.update({ where: { id: userId }, data: { superAdmin } });
  const tenant = await prisma.tenant.findFirst();
  if (tenant) {
    await prisma.auditEvent.create({
      data: { tenantId: tenant.id, actorId: admin.userId, entityType: "User", entityId: userId, action: superAdmin ? "USER_PROMOTED_SUPER_ADMIN" : "USER_DEMOTED_SUPER_ADMIN", source: "admin/super-toggle" },
    });
  }
  return publicRedirect(req, `/admin/users/${userId}`, 303);
}
