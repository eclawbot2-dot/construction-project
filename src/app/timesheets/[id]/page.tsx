import Link from "next/link";
import { notFound } from "next/navigation";
import { DetailShell, DetailGrid, DetailField } from "@/components/layout/detail-shell";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { currentActor } from "@/lib/permissions";
import { loadedLabor, nextActions } from "@/lib/timesheets";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { toNum } from "@/lib/money";

export default async function TimesheetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await requireTenant();
  const actor = await currentActor(tenant.id);
  const entry = await prisma.timeEntry.findFirst({
    where: { id, project: { tenantId: tenant.id } },
    include: { project: true, comments: { orderBy: { createdAt: "asc" } } },
  });
  if (!entry) notFound();

  const loaded = loadedLabor(entry);
  const totalHours = entry.regularHours + entry.overtimeHours + entry.doubleTimeHours;
  const actions = nextActions(entry.status, actor.isManager, actor.canEdit);
  const canEdit = actor.isManager || ((entry.status === "DRAFT" || entry.status === "REJECTED") && actor.canEdit);
  const weekEndingIso = entry.weekEnding.toISOString().slice(0, 10);

  return (
    <DetailShell
      eyebrow="Timesheet"
      title={`${entry.employeeName} · week of ${formatDate(entry.weekEnding)}`}
      subtitle={`${entry.project.code} — ${entry.project.name}`}
      crumbs={[{ label: "Timesheets", href: "/timesheets" }, { label: `${entry.employeeName} · ${formatDate(entry.weekEnding)}` }]}
      actions={<StatusBadge status={entry.status} />}
    >
      <section className="grid gap-4 md:grid-cols-4">
        <StatTile label="Total hours" value={totalHours.toLocaleString()} />
        <StatTile label="Regular / OT / DT" value={`${entry.regularHours} / ${entry.overtimeHours} / ${entry.doubleTimeHours}`} />
        <StatTile label="Rate" value={`${formatCurrency(entry.rate)}/h`} />
        <StatTile label="Loaded labor" value={formatCurrency(loaded)} tone="good" />
      </section>

      <section className="card p-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Entry detail</div>
            <div className="mt-1 text-xs text-slate-500">Acting as <span className="text-white font-semibold">{actor.userName}</span> · role <span className="font-mono text-cyan-200">{actor.role ?? "—"}</span>{actor.isManager ? " · manager" : ""}</div>
          </div>
          <StatusBadge status={entry.status} />
        </div>
        <DetailGrid>
          <DetailField label="Project"><Link href={`/projects/${entry.project.id}/timesheets`} className="text-cyan-300 hover:underline">{entry.project.code}</Link></DetailField>
          <DetailField label="Employee">{entry.employeeName}</DetailField>
          <DetailField label="Trade">{entry.trade ?? "—"}</DetailField>
          <DetailField label="Week ending">{formatDate(entry.weekEnding)}</DetailField>
          <DetailField label="Cost code">{entry.costCode ?? "—"}</DetailField>
          <DetailField label="Submitted">{entry.submittedAt ? `${formatDateTime(entry.submittedAt)}${entry.submittedBy ? ` by ${entry.submittedBy}` : ""}` : "—"}</DetailField>
          <DetailField label="Approved">{entry.approvedAt ? `${formatDateTime(entry.approvedAt)}${entry.approvedBy ? ` by ${entry.approvedBy}` : ""}` : "—"}</DetailField>
          <DetailField label="Rejected">{entry.rejectedAt ? `${formatDateTime(entry.rejectedAt)}${entry.rejectedBy ? ` by ${entry.rejectedBy}` : ""}` : "—"}</DetailField>
          {entry.approvalNote ? <DetailField label="Approval note">{entry.approvalNote}</DetailField> : null}
          {entry.rejectionReason ? <DetailField label="Rejection reason"><span className="text-rose-200">{entry.rejectionReason}</span></DetailField> : null}
          {entry.notes ? <DetailField label="Notes">{entry.notes}</DetailField> : null}
        </DetailGrid>
      </section>

      {actions.length > 0 ? (
        <section className="card p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Actions</div>
          {actor.isManager ? null : <div className="mt-2 text-xs text-slate-500">You are not a manager — approve/reject requires ADMIN, EXECUTIVE, MANAGER, PROGRAM_MANAGER, CONTROLLER, SUPERINTENDENT, SAFETY_MANAGER, or QUALITY_MANAGER role.</div>}
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {actions.find((a) => a.action === "submit") ? (
              <form action={`/api/timesheets/${entry.id}/submit`} method="post" className="panel p-4 space-y-2">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Submit for approval</div>
                <input name="note" placeholder="Optional note for approver" className="form-input" />
                <button className="btn-primary">Submit for approval</button>
              </form>
            ) : null}
            {actions.find((a) => a.action === "approve") ? (
              <form action={`/api/timesheets/${entry.id}/approve`} method="post" className="panel p-4 space-y-2">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Approve (manager only)</div>
                <input name="note" placeholder="Optional approval note" className="form-input" />
                <button className="btn-primary">✓ Approve</button>
              </form>
            ) : null}
            {actions.find((a) => a.action === "reject") ? (
              <form action={`/api/timesheets/${entry.id}/reject`} method="post" className="panel p-4 space-y-2">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Reject (manager only)</div>
                <input name="reason" placeholder="Reason (required, visible to employee)" required minLength={3} className="form-input" />
                <button className="btn-danger">✗ Reject</button>
              </form>
            ) : null}
          </div>
        </section>
      ) : null}

      {canEdit ? (
        <section className="card p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Edit entry</div>
          {entry.status === "APPROVED" || entry.status === "PAID" ? <div className="mt-2 text-xs text-amber-300">Editing an {entry.status.toLowerCase()} entry will revert its status to SUBMITTED for re-approval.</div> : null}
          <form action={`/api/timesheets/${entry.id}/edit`} method="post" className="mt-4 grid gap-3 md:grid-cols-3">
            <div>
              <label className="form-label">Employee</label>
              <input name="employeeName" defaultValue={entry.employeeName} className="form-input" />
            </div>
            <div>
              <label className="form-label">Trade</label>
              <input name="trade" defaultValue={entry.trade ?? ""} className="form-input" />
            </div>
            <div>
              <label className="form-label">Week ending</label>
              <input name="weekEnding" type="date" defaultValue={weekEndingIso} className="form-input" />
            </div>
            <div>
              <label className="form-label">Regular hrs</label>
              <input name="regularHours" type="number" step="0.25" defaultValue={entry.regularHours} className="form-input" />
            </div>
            <div>
              <label className="form-label">Overtime hrs</label>
              <input name="overtimeHours" type="number" step="0.25" defaultValue={entry.overtimeHours} className="form-input" />
            </div>
            <div>
              <label className="form-label">Double-time hrs</label>
              <input name="doubleTimeHours" type="number" step="0.25" defaultValue={entry.doubleTimeHours} className="form-input" />
            </div>
            <div>
              <label className="form-label">Rate ($/h)</label>
              <input name="rate" type="number" step="0.01" defaultValue={toNum(entry.rate)} className="form-input" />
            </div>
            <div>
              <label className="form-label">Cost code</label>
              <input name="costCode" defaultValue={entry.costCode ?? ""} className="form-input" />
            </div>
            <div className="md:col-span-3">
              <label className="form-label">Notes</label>
              <textarea name="notes" defaultValue={entry.notes ?? ""} rows={2} className="form-textarea" />
            </div>
            <div className="md:col-span-3">
              <button className="btn-primary">Save changes</button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="card p-6">
        <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Activity · {entry.comments.length}</div>
        <div className="mt-4 space-y-3">
          {entry.comments.length === 0 ? <div className="text-sm text-slate-500">No activity yet.</div> : null}
          {entry.comments.map((c) => (
            <div key={c.id} className="panel p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium text-white">{c.authorName}</div>
                <div className="flex items-center gap-2 text-xs">
                  <span className={"rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] " + (c.kind === "APPROVE" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : c.kind === "REJECT" ? "border-rose-500/30 bg-rose-500/10 text-rose-200" : c.kind === "SUBMIT" ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-200" : c.kind === "EDIT" ? "border-amber-500/30 bg-amber-500/10 text-amber-200" : "border-white/10 bg-white/5 text-slate-300")}>{c.kind}</span>
                  <span className="text-slate-500">{formatDateTime(c.createdAt)}</span>
                </div>
              </div>
              <div className="mt-2 text-sm text-slate-200 whitespace-pre-wrap">{c.body}</div>
            </div>
          ))}
        </div>
        <form action={`/api/timesheets/${entry.id}/comment`} method="post" className="mt-4 flex gap-2">
          <input name="body" placeholder="Add a comment…" required className="form-input flex-1" />
          <button className="btn-outline">Add</button>
        </form>
      </section>
    </DetailShell>
  );
}
