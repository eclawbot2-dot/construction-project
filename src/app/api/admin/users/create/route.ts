import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/permissions";
import { publicRedirect } from "@/lib/redirect";
import type { UserRoleTemplate } from "@prisma/client";

const ROLES: UserRoleTemplate[] = ["ADMIN", "EXECUTIVE", "MANAGER", "PROGRAM_MANAGER", "CONTROLLER", "SUPERINTENDENT", "PROJECT_ENGINEER", "FOREMAN", "SAFETY_MANAGER", "QUALITY_MANAGER", "COORDINATOR", "VIEWER"];

export async function POST(req: Request) {
  const admin = await requireSuperAdmin();
  const form = await req.formData();
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const superAdmin = form.get("superAdmin") === "on";
  const tenantId = String(form.get("tenantId") ?? "") || null;
  const roleRaw = String(form.get("role") ?? "MANAGER") as UserRoleTemplate;
  const role = ROLES.includes(roleRaw) ? roleRaw : "VIEWER";

  if (!name || !email) return NextResponse.json({ error: "name + email required" }, { status: 400 });
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: `User with email ${email} already exists.` }, { status: 400 });

  const user = await prisma.user.create({
    data: { name, email, superAdmin, password: await bcrypt.hash(`setup-${Math.random().toString(36).slice(2)}`, 10) },
  });
  if (tenantId) {
    await prisma.membership.create({ data: { tenantId, userId: user.id, roleTemplate: role } });
  }
  await prisma.auditEvent.create({
    data: { tenantId: tenantId ?? (await prisma.tenant.findFirst())?.id ?? "system", actorId: admin.userId, entityType: "User", entityId: user.id, action: "USER_CREATED", afterJson: JSON.stringify({ name, email, superAdmin, tenantId, role: tenantId ? role : null }), source: "admin/user-create" },
  });
  return publicRedirect(req, `/admin/users/${user.id}`, 303);
}
