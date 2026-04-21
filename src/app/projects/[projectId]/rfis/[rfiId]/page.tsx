import { notFound } from "next/navigation";
import { DetailShell, DetailGrid, DetailField } from "@/components/layout/detail-shell";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusBadge } from "@/components/ui/status-badge";
import { ApprovalSection, ActivityTrail } from "@/components/approval-section";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { currentActor } from "@/lib/permissions";
import { listComments } from "@/lib/approvals";
import { formatDate } from "@/lib/utils";

export default async function RfiDetailPage({ params }: { params: Promise<{ projectId: string; rfiId: string }> }) {
  const { projectId, rfiId } = await params;
  const tenant = await requireTenant();
  const actor = await currentActor(tenant.id);
  const rfi = await prisma.rFI.findFirst({
    where: { id: rfiId, project: { id: projectId, tenantId: tenant.id } },
    include: { project: true },
  });
  if (!rfi) notFound();
  const comments = await listComments(tenant.id, "RFI", rfi.id);

  const ageDays = Math.round((Date.now() - new Date(rfi.createdAt).getTime()) / (1000 * 60 * 60 * 24));
  const overdue = rfi.dueDate && new Date(rfi.dueDate) < new Date() && rfi.status !== "CLOSED" && rfi.status !== "APPROVED";
  const dueIso = rfi.dueDate ? new Date(rfi.dueDate).toISOString().slice(0, 10) : "";

  const actions: Array<{ name: string; label: string; tone: "primary" | "outline" | "danger"; requireReason?: boolean; formAction: string }> = [];
  if ((rfi.status === "DRAFT" || rfi.status === "REJECTED") && actor.canEdit) actions.push({ name: "submit", label: "Submit for response", tone: "primary", formAction: `/api/rfis/${rfi.id}/submit` });
  if (rfi.status === "UNDER_REVIEW" && rfi.response && actor.isManager) {
    actions.push({ name: "approve", label: "Approve & close", tone: "primary", formAction: `/api/rfis/${rfi.id}/approve` });
    actions.push({ name: "reject", label: "Reject", tone: "danger", requireReason: true, formAction: `/api/rfis/${rfi.id}/reject` });
  }

  return (
    <DetailShell
      eyebrow={`${rfi.project.code} · RFI`}
      title={`${rfi.number} — ${rfi.subject}`}
      crumbs={[{ label: "Projects", href: "/projects" }, { label: rfi.project.code, href: `/projects/${rfi.project.id}` }, { label: "RFIs", href: `/projects/${rfi.project.id}/rfis` }, { label: rfi.number }]}
      actions={<StatusBadge status={rfi.status} />}
    >
      <section className="grid gap-4 md:grid-cols-4">
        <StatTile label="Age" value={`${ageDays}d`} tone={ageDays > 14 ? "warn" : "default"} />
        <StatTile label="Ball in court" value={rfi.ballInCourt ?? "—"} />
        <StatTile label="Due" value={formatDate(rfi.dueDate)} tone={overdue ? "bad" : "default"} sub={overdue ? "Overdue" : undefined} />
        <StatTile label="Has response" value={rfi.response ? "Yes" : "No"} tone={rfi.response ? "good" : "warn"} />
      </section>

      <section className="card p-6">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-400">RFI detail</div>
        <DetailGrid>
          <DetailField label="Number">{rfi.number}</DetailField>
          <DetailField label="Subject">{rfi.subject}</DetailField>
          <DetailField label="Status">{rfi.status.replaceAll("_", " ")}</DetailField>
          <DetailField label="Ball in court">{rfi.ballInCourt ?? "—"}</DetailField>
          <DetailField label="Due">{formatDate(rfi.dueDate)}</DetailField>
          <DetailField label="Submitted">{formatDate(rfi.submittedAt)}{rfi.submittedBy ? ` by ${rfi.submittedBy}` : ""}</DetailField>
          <DetailField label="Responded">{formatDate(rfi.respondedAt)}{rfi.respondedBy ? ` by ${rfi.respondedBy}` : ""}</DetailField>
          <DetailField label="Approved">{formatDate(rfi.approvedAt)}{rfi.approvedBy ? ` by ${rfi.approvedBy}` : ""}</DetailField>
          {rfi.question ? <DetailField label="Question">{rfi.question}</DetailField> : null}
          {rfi.response ? <DetailField label="Response">{rfi.response}</DetailField> : null}
          {rfi.rejectionReason ? <DetailField label="Rejection reason"><span className="text-rose-200">{rfi.rejectionReason}</span></DetailField> : null}
        </DetailGrid>
      </section>

      <ApprovalSection title="Actions" status={rfi.status} actions={actions} actorName={actor.userName} actorRole={actor.role} isManager={actor.isManager} />

      {rfi.status === "UNDER_REVIEW" && actor.canEdit ? (
        <section className="card p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Respond</div>
          <form action={`/api/rfis/${rfi.id}/respond`} method="post" className="mt-4 space-y-3">
            <textarea name="response" defaultValue={rfi.response ?? ""} rows={4} required placeholder="Formal response to this RFI…" className="form-textarea" />
            <button className="btn-primary">{rfi.response ? "Update response" : "Submit response"}</button>
          </form>
        </section>
      ) : null}

      {actor.canEdit ? (
        <section className="card p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Edit RFI</div>
          <form action={`/api/rfis/${rfi.id}/edit`} method="post" className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="md:col-span-2"><label className="form-label">Subject</label><input name="subject" defaultValue={rfi.subject} className="form-input" /></div>
            <div><label className="form-label">Ball in court</label><input name="ballInCourt" defaultValue={rfi.ballInCourt ?? ""} className="form-input" /></div>
            <div><label className="form-label">Due date</label><input name="dueDate" type="date" defaultValue={dueIso} className="form-input" /></div>
            <div className="md:col-span-3"><label className="form-label">Question</label><textarea name="question" defaultValue={rfi.question ?? ""} rows={3} className="form-textarea" /></div>
            <div className="md:col-span-3"><button className="btn-primary">Save changes</button></div>
          </form>
        </section>
      ) : null}

      <ActivityTrail comments={comments} commentAction={`/api/records/RFI/${rfi.id}/comment`} />
    </DetailShell>
  );
}
