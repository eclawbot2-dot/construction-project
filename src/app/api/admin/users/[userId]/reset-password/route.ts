import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/permissions";
import { publicRedirect } from "@/lib/redirect";

export async function POST(req: Request, ctx: { params: Promise<{ userId: string }> }) {
  const admin = await requireSuperAdmin();
  const { userId } = await ctx.params;
  await prisma.user.update({ where: { id: userId }, data: { password: await bcrypt.hash(`reset-${Math.random().toString(36).slice(2, 14)}`, 10) } });
  const tenant = await prisma.tenant.findFirst();
  if (tenant) {
    await prisma.auditEvent.create({
      data: { tenantId: tenant.id, actorId: admin.userId, entityType: "User", entityId: userId, action: "USER_PASSWORD_RESET", source: "admin/password-reset" },
    });
  }
  return publicRedirect(req, `/admin/users/${userId}`, 303);
}
