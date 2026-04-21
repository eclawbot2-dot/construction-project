import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { currentActor, currentSuperAdmin } from "@/lib/permissions";
import { UserRoleTemplate } from "@prisma/client";
import { publicRedirect } from "@/lib/redirect";

const VALID: UserRoleTemplate[] = [
  "ADMIN", "EXECUTIVE", "MANAGER", "RECRUITER", "COORDINATOR", "CAPTURE_MANAGER",
  "PROGRAM_MANAGER", "ACCOUNT_EXECUTIVE", "VIEWER",
  "PROJECT_ENGINEER", "SUPERINTENDENT", "FOREMAN", "CONTROLLER", "SAFETY_MANAGER", "QUALITY_MANAGER",
];

export async function POST(req: Request) {
  const tenant = await requireTenant();

  // Permission gate: only the tenant's own ADMIN-role members or a platform
  // super admin may invite new users into this tenant. Regular members
  // (MANAGER, SUPERINTENDENT, etc.) can NOT.
  const [actor, sa] = await Promise.all([currentActor(tenant.id), currentSuperAdmin()]);
  const isTenantAdmin = actor.role === "ADMIN";
  if (!isTenantAdmin && !sa) {
    return NextResponse.json({ error: "Only tenant admins (ADMIN role) or platform super admins may invite users into this tenant." }, { status: 403 });
  }

  const form = await req.formData();
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const roleRaw = String(form.get("role") ?? "VIEWER");
  const businessUnitId = String(form.get("businessUnitId") ?? "") || null;
  const role = (VALID as string[]).includes(roleRaw) ? (roleRaw as UserRoleTemplate) : UserRoleTemplate.VIEWER;

  if (!name || !email) return NextResponse.json({ error: "name and email required" }, { status: 400 });

  // Additional guard: a tenant admin cannot create another ADMIN — only
  // super admins can mint tenant admins (avoids lateral escalation).
  if (role === "ADMIN" && !sa) {
    return NextResponse.json({ error: "Only super admins can grant the ADMIN role. Ask a platform super admin to promote this user." }, { status: 403 });
  }

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({ data: { name, email, password: await bcrypt.hash("invite-" + Math.random().toString(36).slice(2), 10) } });
  }
  const existingMembership = await prisma.membership.findFirst({ where: { tenantId: tenant.id, userId: user.id } });
  if (existingMembership) {
    await prisma.membership.update({ where: { id: existingMembership.id }, data: { roleTemplate: role, businessUnitId: businessUnitId ?? existingMembership.businessUnitId } });
  } else {
    await prisma.membership.create({ data: { tenantId: tenant.id, userId: user.id, roleTemplate: role, businessUnitId: businessUnitId ?? undefined } });
  }
  await prisma.auditEvent.create({
    data: {
      tenantId: tenant.id,
      actorId: sa?.userId ?? actor.userId ?? undefined,
      entityType: "Membership",
      entityId: user.id,
      action: existingMembership ? "MEMBERSHIP_UPDATED" : "USER_INVITED",
      afterJson: JSON.stringify({ email, role, businessUnitId, byTenantAdmin: isTenantAdmin, bySuperAdmin: !!sa }),
      source: "users/invite",
    },
  });
  return publicRedirect(req, "/settings", 303);
}
