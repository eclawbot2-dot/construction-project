import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/permissions";
import { publicRedirect } from "@/lib/redirect";
import type { UserRoleTemplate } from "@prisma/client";

const ROLES: UserRoleTemplate[] = ["ADMIN", "EXECUTIVE", "MANAGER", "PROGRAM_MANAGER", "CONTROLLER", "SUPERINTENDENT", "PROJECT_ENGINEER", "FOREMAN", "SAFETY_MANAGER", "QUALITY_MANAGER", "COORDINATOR", "VIEWER", "RECRUITER", "CAPTURE_MANAGER", "ACCOUNT_EXECUTIVE"];

export async function POST(req: Request, ctx: { params: Promise<{ tenantId: string; membershipId: string }> }) {
  const admin = await requireSuperAdmin();
  const { tenantId, membershipId } = await ctx.params;
  const form = await req.formData();
  const roleRaw = String(form.get("role") ?? "") as UserRoleTemplate;
  const role = ROLES.includes(roleRaw) ? roleRaw : "VIEWER";
  await prisma.membership.update({ where: { id: membershipId }, data: { roleTemplate: role } });
  await prisma.auditEvent.create({
    data: { tenantId, actorId: admin.userId, entityType: "Membership", entityId: membershipId, action: "MEMBERSHIP_ROLE_CHANGED", afterJson: JSON.stringify({ role }), source: "admin/member-role" },
  });
  return publicRedirect(req, `/admin/tenants/${tenantId}`, 303);
}
