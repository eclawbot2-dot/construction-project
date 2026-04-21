import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/permissions";
import { publicRedirect } from "@/lib/redirect";
import type { UserRoleTemplate } from "@prisma/client";

const ROLES: UserRoleTemplate[] = ["ADMIN", "EXECUTIVE", "MANAGER", "PROGRAM_MANAGER", "CONTROLLER", "SUPERINTENDENT", "PROJECT_ENGINEER", "FOREMAN", "SAFETY_MANAGER", "QUALITY_MANAGER", "COORDINATOR", "VIEWER", "RECRUITER", "CAPTURE_MANAGER", "ACCOUNT_EXECUTIVE"];

export async function POST(req: Request, ctx: { params: Promise<{ tenantId: string }> }) {
  const admin = await requireSuperAdmin();
  const { tenantId } = await ctx.params;
  const form = await req.formData();
  const userIdRaw = String(form.get("userId") ?? "").trim();
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const roleRaw = String(form.get("role") ?? "MANAGER") as UserRoleTemplate;
  const role = ROLES.includes(roleRaw) ? roleRaw : "VIEWER";
  const businessUnitId = String(form.get("businessUnitId") ?? "") || null;

  let userId = userIdRaw;
  if (!userId) {
    if (!email) return NextResponse.json({ error: "Select a user or provide email" }, { status: 400 });
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) userId = existing.id;
    else {
      const u = await prisma.user.create({
        data: { name: name || email, email, password: await bcrypt.hash(`setup-${Math.random().toString(36).slice(2)}`, 10) },
      });
      userId = u.id;
    }
  }

  const existingMembership = await prisma.membership.findFirst({ where: { tenantId, userId } });
  if (existingMembership) {
    await prisma.membership.update({ where: { id: existingMembership.id }, data: { roleTemplate: role, businessUnitId } });
  } else {
    await prisma.membership.create({ data: { tenantId, userId, roleTemplate: role, businessUnitId } });
  }
  await prisma.auditEvent.create({
    data: { tenantId, actorId: admin.userId, entityType: "Membership", entityId: userId, action: existingMembership ? "MEMBERSHIP_UPDATED" : "MEMBERSHIP_CREATED", afterJson: JSON.stringify({ role, businessUnitId }), source: "admin/member-create" },
  });
  return publicRedirect(req, `/admin/tenants/${tenantId}`, 303);
}
