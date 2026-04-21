/**
 * Shared approval / editing framework used by every module with a status
 * lifecycle (change orders, pay apps, RFIs, submittals, safety incidents,
 * punch items, sub-invoices, purchase orders, contracts, lien waivers).
 *
 * Provides:
 *   - logComment(): writes to the polymorphic RecordComment table
 *   - actorFor(): canonical acting-user resolution
 *   - requireManager(): throws if current actor is not a manager role
 *
 * Each module keeps a thin action lib that composes these helpers with its
 * own status-transition rules.
 */

import { prisma } from "@/lib/prisma";
import { currentActor, type CurrentActor } from "@/lib/permissions";

export type CommentKind =
  | "COMMENT"
  | "CREATE"
  | "EDIT"
  | "SUBMIT"
  | "APPROVE"
  | "REJECT"
  | "CLOSE"
  | "REOPEN"
  | "PAY"
  | "RESPOND"
  | "SYSTEM";

export async function logComment(params: {
  tenantId: string;
  entityType: string;
  entityId: string;
  actorName: string;
  actorId: string | null;
  kind: CommentKind;
  body: string;
}): Promise<void> {
  await prisma.recordComment.create({
    data: {
      tenantId: params.tenantId,
      entityType: params.entityType,
      entityId: params.entityId,
      authorName: params.actorName,
      authorId: params.actorId ?? undefined,
      kind: params.kind,
      body: params.body,
    },
  });
}

export async function listComments(tenantId: string, entityType: string, entityId: string) {
  return prisma.recordComment.findMany({
    where: { tenantId, entityType, entityId },
    orderBy: { createdAt: "asc" },
  });
}

export async function actorFor(tenantId: string): Promise<CurrentActor> {
  return currentActor(tenantId);
}

export type ActionResult<T = unknown> = { ok: true; entity: T } | { ok: false; error: string };

export function err(message: string): ActionResult<never> {
  return { ok: false, error: message };
}

/** Strip fields with `undefined` so Prisma.update only applies real changes. */
export function compactPatch<T extends Record<string, unknown>>(patch: T): Partial<T> {
  const out: Partial<T> = {};
  for (const k of Object.keys(patch) as Array<keyof T>) {
    if (patch[k] !== undefined) out[k] = patch[k];
  }
  return out;
}

/** Diff-string for edit audit logs. */
export function changeSummary(before: Record<string, unknown>, patch: Record<string, unknown>): string {
  return Object.entries(patch)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => {
      const b = before[k];
      return b === v ? null : `${k}: ${JSON.stringify(b)} → ${JSON.stringify(v)}`;
    })
    .filter(Boolean)
    .join(", ");
}
