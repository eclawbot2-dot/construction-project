import { prisma } from "@/lib/prisma";
import { currentActor } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import type { TimeEntry, TimeEntryStatus } from "@prisma/client";

export type TimesheetActionResult = { ok: boolean; error?: string; entry?: TimeEntry };

export function loadedLabor(entry: Pick<TimeEntry, "regularHours" | "overtimeHours" | "doubleTimeHours" | "rate">): number {
  return entry.regularHours * entry.rate + entry.overtimeHours * entry.rate * 1.5 + entry.doubleTimeHours * entry.rate * 2;
}

const TIMESHEET_AUDITED_KINDS = new Set(["CREATE", "EDIT", "SUBMIT", "APPROVE", "REJECT"]);

async function logComment(
  entryId: string,
  tenantId: string,
  actorName: string,
  actorId: string | null,
  kind: string,
  body: string,
): Promise<void> {
  await prisma.timeEntryComment.create({ data: { entryId, authorName: actorName, authorId: actorId ?? undefined, kind, body } });
  if (TIMESHEET_AUDITED_KINDS.has(kind)) {
    await recordAudit({
      tenantId,
      actorId,
      actorName,
      entityType: "TimeEntry",
      entityId: entryId,
      action: kind,
      after: { note: body },
      source: "timesheets",
    });
  }
}

export async function submitTimesheet(id: string, tenantId: string, note?: string): Promise<TimesheetActionResult> {
  const actor = await currentActor(tenantId);
  const entry = await prisma.timeEntry.findFirst({ where: { id, project: { tenantId } } });
  if (!entry) return { ok: false, error: "Entry not found." };
  if (entry.status !== "DRAFT" && entry.status !== "REJECTED") return { ok: false, error: `Cannot submit while status is ${entry.status}.` };
  const updated = await prisma.timeEntry.update({
    where: { id },
    data: { status: "SUBMITTED", submittedAt: new Date(), submittedBy: actor.userName, rejectionReason: null },
  });
  await logComment(id, tenantId, actor.userName, actor.userId, "SUBMIT", note ? `Submitted for approval. Note: ${note}` : "Submitted for approval.");
  return { ok: true, entry: updated };
}

export async function approveTimesheet(id: string, tenantId: string, note?: string): Promise<TimesheetActionResult> {
  const actor = await currentActor(tenantId);
  if (!actor.isManager) return { ok: false, error: "Only managers can approve timesheets." };
  const entry = await prisma.timeEntry.findFirst({ where: { id, project: { tenantId } } });
  if (!entry) return { ok: false, error: "Entry not found." };
  if (entry.status !== "SUBMITTED") return { ok: false, error: `Cannot approve while status is ${entry.status}. Entry must be SUBMITTED.` };
  const updated = await prisma.timeEntry.update({
    where: { id },
    data: { status: "APPROVED", approvedAt: new Date(), approvedBy: actor.userName, approvalNote: note ?? null, rejectedAt: null, rejectedBy: null, rejectionReason: null },
  });
  await logComment(id, tenantId, actor.userName, actor.userId, "APPROVE", note ? `Approved — ${note}` : "Approved.");
  return { ok: true, entry: updated };
}

export async function rejectTimesheet(id: string, tenantId: string, reason: string): Promise<TimesheetActionResult> {
  const actor = await currentActor(tenantId);
  if (!actor.isManager) return { ok: false, error: "Only managers can reject timesheets." };
  if (!reason || reason.trim().length < 3) return { ok: false, error: "Rejection reason is required (min 3 chars)." };
  const entry = await prisma.timeEntry.findFirst({ where: { id, project: { tenantId } } });
  if (!entry) return { ok: false, error: "Entry not found." };
  if (entry.status !== "SUBMITTED") return { ok: false, error: `Cannot reject while status is ${entry.status}. Entry must be SUBMITTED.` };
  const updated = await prisma.timeEntry.update({
    where: { id },
    data: { status: "REJECTED", rejectedAt: new Date(), rejectedBy: actor.userName, rejectionReason: reason.trim() },
  });
  await logComment(id, tenantId, actor.userName, actor.userId, "REJECT", `Rejected: ${reason.trim()}`);
  return { ok: true, entry: updated };
}

export async function editTimesheet(id: string, tenantId: string, patch: Partial<Pick<TimeEntry, "employeeName" | "trade" | "weekEnding" | "regularHours" | "overtimeHours" | "doubleTimeHours" | "rate" | "costCode" | "notes">>): Promise<TimesheetActionResult> {
  const actor = await currentActor(tenantId);
  const entry = await prisma.timeEntry.findFirst({ where: { id, project: { tenantId } } });
  if (!entry) return { ok: false, error: "Entry not found." };
  // Edit rules:
  //   - DRAFT: anyone with edit role (or the employee themselves — we treat all EDIT_ROLES as OK)
  //   - REJECTED: same as DRAFT (so employee can fix and re-submit)
  //   - SUBMITTED / APPROVED / PAID: only managers
  const editable = entry.status === "DRAFT" || entry.status === "REJECTED"
    ? actor.canEdit
    : actor.isManager;
  if (!editable) return { ok: false, error: `Cannot edit while status is ${entry.status} without manager role.` };

  const data: Record<string, unknown> = {};
  if (patch.employeeName !== undefined) data.employeeName = patch.employeeName;
  if (patch.trade !== undefined) data.trade = patch.trade;
  if (patch.weekEnding !== undefined) data.weekEnding = patch.weekEnding;
  if (patch.regularHours !== undefined) data.regularHours = patch.regularHours;
  if (patch.overtimeHours !== undefined) data.overtimeHours = patch.overtimeHours;
  if (patch.doubleTimeHours !== undefined) data.doubleTimeHours = patch.doubleTimeHours;
  if (patch.rate !== undefined) data.rate = patch.rate;
  if (patch.costCode !== undefined) data.costCode = patch.costCode;
  if (patch.notes !== undefined) data.notes = patch.notes;
  if (Object.keys(data).length === 0) return { ok: false, error: "Nothing to update." };

  // Manager edits on APPROVED/PAID entries bump status back to SUBMITTED for re-approval.
  if (entry.status === "APPROVED" || entry.status === "PAID") {
    data.status = "SUBMITTED";
    data.approvedAt = null;
    data.approvedBy = null;
    data.approvalNote = null;
  }

  const changes = Object.entries(data)
    .filter(([k]) => k !== "status")
    .map(([k, v]) => {
      const before = (entry as Record<string, unknown>)[k];
      return `${k}: ${JSON.stringify(before)} → ${JSON.stringify(v)}`;
    }).join(", ");

  const updated = await prisma.timeEntry.update({ where: { id }, data });
  await logComment(id, tenantId, actor.userName, actor.userId, "EDIT", `Edited: ${changes}`);
  return { ok: true, entry: updated };
}

export async function commentOnTimesheet(id: string, tenantId: string, body: string): Promise<TimesheetActionResult> {
  const actor = await currentActor(tenantId);
  if (!body || body.trim().length < 1) return { ok: false, error: "Comment body required." };
  const entry = await prisma.timeEntry.findFirst({ where: { id, project: { tenantId } } });
  if (!entry) return { ok: false, error: "Entry not found." };
  await logComment(id, tenantId, actor.userName, actor.userId, "COMMENT", body.trim());
  return { ok: true, entry };
}

export async function createTimesheet(tenantId: string, input: { projectId: string; employeeName: string; trade?: string; weekEnding: Date; regularHours: number; overtimeHours?: number; doubleTimeHours?: number; rate: number; costCode?: string; notes?: string }): Promise<TimesheetActionResult> {
  const actor = await currentActor(tenantId);
  const project = await prisma.project.findFirst({ where: { id: input.projectId, tenantId } });
  if (!project) return { ok: false, error: "Project not found in this tenant." };
  const entry = await prisma.timeEntry.create({
    data: {
      projectId: input.projectId,
      employeeName: input.employeeName,
      trade: input.trade,
      weekEnding: input.weekEnding,
      regularHours: input.regularHours,
      overtimeHours: input.overtimeHours ?? 0,
      doubleTimeHours: input.doubleTimeHours ?? 0,
      rate: input.rate,
      costCode: input.costCode,
      notes: input.notes,
      status: "DRAFT",
    },
  });
  await logComment(entry.id, tenantId, actor.userName, actor.userId, "CREATE", `Created draft by ${actor.userName}.`);
  return { ok: true, entry };
}

export function nextActions(status: TimeEntryStatus, isManager: boolean, canEdit: boolean): Array<{ action: "submit" | "approve" | "reject" | "edit"; label: string; tone: "primary" | "outline" | "danger" }> {
  const actions: Array<{ action: "submit" | "approve" | "reject" | "edit"; label: string; tone: "primary" | "outline" | "danger" }> = [];
  if (status === "DRAFT" || status === "REJECTED") {
    if (canEdit) actions.push({ action: "edit", label: "Edit", tone: "outline" });
    if (canEdit) actions.push({ action: "submit", label: "Submit for approval", tone: "primary" });
  }
  if (status === "SUBMITTED") {
    if (isManager) actions.push({ action: "approve", label: "Approve", tone: "primary" });
    if (isManager) actions.push({ action: "reject", label: "Reject", tone: "danger" });
    if (isManager) actions.push({ action: "edit", label: "Edit", tone: "outline" });
  }
  if (status === "APPROVED" || status === "PAID") {
    if (isManager) actions.push({ action: "edit", label: "Edit (re-approval required)", tone: "outline" });
  }
  return actions;
}
