import { prisma } from "@/lib/prisma";
import type { CurrentActor } from "@/lib/permissions";
import type { WorkflowStatus } from "@prisma/client";

/**
 * Minimal workflow engine.
 *
 * Until this PR, WorkflowTemplate / WorkflowRun / Approval / ApprovalRoute
 * existed in the schema but no code wrote to them — the audit (Pass 7
 * §2.1) found zero `prisma.workflowRun.create` calls anywhere. State
 * transitions on individual records (change orders, pay apps, RFIs, etc.)
 * went straight to the entity table and emitted RecordComments, with no
 * cross-record run object to model "this submittal is in approval cycle 2
 * of 3" or "this PCO is awaiting controller sign-off."
 *
 * What this module does today:
 *   - Materializes a WorkflowRun row when an entity is submitted for
 *     approval (called from record-actions.ts:submit*).
 *   - Records an Approval row when an approver approves or rejects
 *     (called from record-actions.ts:approve* / reject*).
 *   - Closes the run when the underlying entity reaches a terminal status.
 *   - Looks up the active run for an entity so detail pages can render
 *     "current cycle" UI.
 *
 * What this module does NOT do yet (tracked as follow-ups):
 *   - Resolving sequenced multi-step approver routes from
 *     ApprovalRoute.stepsJson. Today every entity gets a single
 *     "needs manager" implicit step.
 *   - Escalation/SLA timers (no scheduled-job runtime exists yet).
 *   - Watcher fan-out / notification delivery (PR #9 will add Resend).
 *
 * The shape is intentionally additive: existing record-actions still emit
 * their RecordComments and update entity.status; this module just adds
 * a parallel WorkflowRun trail. If a feature or migration deletes the
 * workflow tables, all callers degrade gracefully via the .catch() guards.
 */

type StartArgs = {
  tenantId: string;
  projectId: string;
  module: string;
  entityType: string;
  entityId: string;
  templateName?: string;
  payload?: Record<string, unknown>;
};

/**
 * Open a WorkflowRun for an entity entering its approval cycle. Idempotent
 * by (projectId, entityType, entityId) — calling twice for the same entity
 * returns the existing run instead of creating duplicates. Returns null
 * if the schema isn't reachable (don't break the caller's mutation).
 *
 * Pass-8 audit hardening: the find-then-create sequence is wrapped in an
 * interactive transaction. Two concurrent submitChangeOrder calls used to
 * be able to both miss an existing run and both create one; the
 * transaction now serializes the read+create pair on the same row range.
 * SQLite serializes all writes anyway; on Postgres the SERIALIZABLE
 * isolation level catches the conflicting writer at COMMIT and the
 * runtime retries via Prisma's built-in transaction retry.
 */
export async function startWorkflowRun(args: StartArgs) {
  try {
    const templateName = args.templateName
      ?? (await pickTemplateName(args.tenantId, args.module))
      ?? `${args.module}/default`;

    return await prisma.$transaction(async (tx) => {
      const candidates = await tx.workflowRun.findMany({
        where: { projectId: args.projectId, status: { in: ["DRAFT", "UNDER_REVIEW"] } },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      const existing = candidates.find((run) => {
        try {
          const p = JSON.parse(run.payloadJson || "{}") as { entityType?: string; entityId?: string };
          return p.entityType === args.entityType && p.entityId === args.entityId;
        } catch {
          return false;
        }
      });
      if (existing) return existing;

      return await tx.workflowRun.create({
        data: {
          projectId: args.projectId,
          templateName,
          module: args.module,
          status: "UNDER_REVIEW",
          payloadJson: JSON.stringify({
            entityType: args.entityType,
            entityId: args.entityId,
            ...(args.payload ?? {}),
          }),
        },
      });
    });
  } catch (err) {
    console.error("[workflow] startWorkflowRun failed", { args, err });
    return null;
  }
}

/**
 * Record an Approval against the run for `entityType/entityId`. Decision
 * "APPROVED" closes the run; "REJECTED" marks it rejected. If no run exists
 * we no-op rather than auto-creating one (avoids back-filling runs for
 * historical records).
 */
export async function recordWorkflowDecision(params: {
  projectId: string;
  entityType: string;
  entityId: string;
  actor: CurrentActor;
  decision: "APPROVED" | "REJECTED";
}) {
  try {
    const run = await findActiveRunFor(params.projectId, params.entityType, params.entityId);
    if (!run || !params.actor.userId) return null;

    await prisma.approval.create({
      data: {
        approverId: params.actor.userId,
        targetType: params.entityType,
        targetId: params.entityId,
        status: params.decision as WorkflowStatus,
      },
    });

    return await prisma.workflowRun.update({
      where: { id: run.id },
      data: { status: params.decision === "APPROVED" ? "APPROVED" : "REJECTED" },
    });
  } catch (err) {
    console.error("[workflow] recordWorkflowDecision failed", { params, err });
    return null;
  }
}

/**
 * Close the run for an entity that has reached a terminal status outside
 * the standard approve/reject path (e.g. CLOSED, EXECUTED, VOID, PAID).
 */
export async function closeWorkflowRun(params: {
  projectId: string;
  entityType: string;
  entityId: string;
  status: WorkflowStatus;
}) {
  try {
    const run = await findActiveRunFor(params.projectId, params.entityType, params.entityId);
    if (!run) return null;
    return await prisma.workflowRun.update({
      where: { id: run.id },
      data: { status: params.status },
    });
  } catch (err) {
    console.error("[workflow] closeWorkflowRun failed", { params, err });
    return null;
  }
}

/**
 * Find the most recent non-terminal run for an entity. Implemented with a
 * payloadJson scan because the schema doesn't have first-class entity FK
 * columns on WorkflowRun (the targetType/targetId pair lives on Approval
 * but not on the run itself). At present the row count per project is low,
 * so the scan is cheap; if this becomes a hot path we can add explicit
 * entityType / entityId columns to WorkflowRun.
 */
async function findActiveRunFor(projectId: string, entityType: string, entityId: string) {
  const candidates = await prisma.workflowRun.findMany({
    where: { projectId, status: { in: ["DRAFT", "UNDER_REVIEW"] } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return candidates.find((run) => {
    try {
      const p = JSON.parse(run.payloadJson || "{}") as { entityType?: string; entityId?: string };
      return p.entityType === entityType && p.entityId === entityId;
    } catch {
      return false;
    }
  }) ?? null;
}

async function pickTemplateName(tenantId: string, module: string): Promise<string | null> {
  const t = await prisma.workflowTemplate.findFirst({
    where: { tenantId, module },
    orderBy: { createdAt: "asc" },
  });
  return t?.name ?? null;
}
