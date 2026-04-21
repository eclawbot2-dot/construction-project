import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/permissions";
import { publicRedirect } from "@/lib/redirect";

export async function POST(req: Request, ctx: { params: Promise<{ userId: string }> }) {
  const admin = await requireSuperAdmin();
  const { userId } = await ctx.params;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "not found" }, { status: 404 });
  const form = await req.formData();
  const confirm = String(form.get("confirm") ?? "");
  if (confirm !== user.email) return NextResponse.json({ error: "Confirmation must match email." }, { status: 400 });
  if (user.id === admin.userId) return NextResponse.json({ error: "Cannot delete yourself." }, { status: 400 });
  const tenant = await prisma.tenant.findFirst();
  if (tenant) {
    await prisma.auditEvent.create({
      data: { tenantId: tenant.id, actorId: admin.userId, entityType: "User", entityId: userId, action: "USER_DELETED", beforeJson: JSON.stringify({ email: user.email }), source: "admin/user-delete" },
    });
  }
  await prisma.user.delete({ where: { id: userId } });
  return publicRedirect(req, `/admin/users`, 303);
}
