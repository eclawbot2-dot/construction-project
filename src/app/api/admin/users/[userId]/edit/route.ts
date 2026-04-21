import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/permissions";
import { publicRedirect } from "@/lib/redirect";

export async function POST(req: Request, ctx: { params: Promise<{ userId: string }> }) {
  const admin = await requireSuperAdmin();
  const { userId } = await ctx.params;
  const form = await req.formData();
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!name || !email) return NextResponse.json({ error: "name + email required" }, { status: 400 });
  await prisma.user.update({ where: { id: userId }, data: { name, email } });
  const tenant = await prisma.tenant.findFirst();
  if (tenant) {
    await prisma.auditEvent.create({
      data: { tenantId: tenant.id, actorId: admin.userId, entityType: "User", entityId: userId, action: "USER_EDITED", afterJson: JSON.stringify({ name, email }), source: "admin/user-edit" },
    });
  }
  return publicRedirect(req, `/admin/users/${userId}`, 303);
}
