import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { UserRoleTemplate } from "@prisma/client";

const ACTOR_COOKIE = "cx.actor";

/**
 * Role tiers used across approval flows.
 *
 * MANAGER_ROLES — may approve / reject submissions (timesheets, change
 *   orders, pay apps, RFIs, submittals, safety incidents, contracts).
 * EDIT_ROLES    — may edit a record regardless of the submitter.
 * VIEWER_ROLES  — read-only.
 */
export const MANAGER_ROLES: UserRoleTemplate[] = [
  "ADMIN",
  "EXECUTIVE",
  "MANAGER",
  "PROGRAM_MANAGER",
  "CONTROLLER",
  "SUPERINTENDENT",
  "SAFETY_MANAGER",
  "QUALITY_MANAGER",
];

export const EDIT_ROLES: UserRoleTemplate[] = [
  ...MANAGER_ROLES,
  "PROJECT_ENGINEER",
  "FOREMAN",
  "COORDINATOR",
];

export type CurrentActor = {
  userId: string | null;
  userName: string;
  email: string | null;
  role: UserRoleTemplate | null;
  isManager: boolean;
  canEdit: boolean;
};

/**
 * Resolve the current acting user for the active tenant. Falls back to the
 * first Admin membership if no `cx.actor` cookie is set (useful for local
 * dev and single-operator tenants).
 */
export async function currentActor(tenantId: string): Promise<CurrentActor> {
  const store = await cookies().catch(() => null);
  const actorSlug = store?.get(ACTOR_COOKIE)?.value ?? null;

  let membership: { id: string; userId: string; roleTemplate: UserRoleTemplate; user: { id: string; name: string; email: string | null } } | null = null;

  if (actorSlug) {
    const m = await prisma.membership.findFirst({
      where: { tenantId, OR: [{ userId: actorSlug }, { user: { email: actorSlug } }] },
      include: { user: true },
    });
    if (m) membership = m;
  }
  if (!membership) {
    // Prefer ADMIN → EXECUTIVE → MANAGER → first available membership.
    for (const r of ["ADMIN", "EXECUTIVE", "MANAGER"] as const) {
      const m = await prisma.membership.findFirst({ where: { tenantId, roleTemplate: r }, include: { user: true } });
      if (m) { membership = m; break; }
    }
    if (!membership) {
      const any = await prisma.membership.findFirst({ where: { tenantId }, include: { user: true } });
      if (any) membership = any;
    }
  }

  if (!membership) {
    return { userId: null, userName: "Unknown user", email: null, role: null, isManager: false, canEdit: false };
  }

  const role = membership.roleTemplate;
  return {
    userId: membership.user.id,
    userName: membership.user.name,
    email: membership.user.email,
    role,
    isManager: MANAGER_ROLES.includes(role),
    canEdit: EDIT_ROLES.includes(role),
  };
}

export function isManagerRole(role: UserRoleTemplate | null | undefined): boolean {
  return !!role && MANAGER_ROLES.includes(role);
}

export function canEditRole(role: UserRoleTemplate | null | undefined): boolean {
  return !!role && EDIT_ROLES.includes(role);
}
