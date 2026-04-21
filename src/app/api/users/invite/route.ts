import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { UserRoleTemplate } from "@prisma/client";
import { publicRedirect } from "@/lib/redirect";

const VALID: UserRoleTemplate[] = [
  "ADMIN", "EXECUTIVE", "MANAGER", "RECRUITER", "COORDINATOR", "CAPTURE_MANAGER",
  "PROGRAM_MANAGER", "ACCOUNT_EXECUTIVE", "VIEWER",
  "PROJECT_ENGINEER", "SUPERINTENDENT", "FOREMAN", "CONTROLLER", "SAFETY_MANAGER", "QUALITY_MANAGER",
];

export async function POST(req: Request) {
  const tenant = await requireTenant();
  const form = await req.formData();
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const roleRaw = String(form.get("role") ?? "VIEWER");
  const businessUnitId = String(form.get("businessUnitId") ?? "") || null;
  const role = (VALID as string[]).includes(roleRaw) ? (roleRaw as UserRoleTemplate) : UserRoleTemplate.VIEWER;

  if (!name || !email) return NextResponse.json({ error: "name and email required" }, { status: 400 });

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
      entityType: "Membership",
      entityId: user.id,
      action: existingMembership ? "MEMBERSHIP_UPDATED" : "USER_INVITED",
      afterJson: JSON.stringify({ email, role, businessUnitId }),
      source: "users/invite",
    },
  });
  return publicRedirect(req, "/settings", 303);
}
