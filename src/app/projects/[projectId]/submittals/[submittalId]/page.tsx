import Link from "next/link";
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

export default async function SubmittalDetailPage({ params }: { params: Promise<{ projectId: string; submittalId: string }> }) {
  const { projectId, submittalId } = await params;
  const tenant = await requireTenant();
  const actor = await currentActor(tenant.id);
  const sub = await prisma.submittal.findFirst({
    where: { id: submittalId, project: { id: projectId, tenantId: tenant.id } },
    include: { project: true },
  });
  if (!sub) notFound();
  const comments = await listComments(tenant.id, "Submittal", sub.id);

  const actions: Array<{ name: string; label: string; tone: "primary" | "outline" | "danger"; requireReason?: boolean; formAction: string }> = [];
  if ((sub.status === "DRAFT" || sub.status === "REJECTED") && actor.canEdit) actions.push({ name: "submit", label: "Submit for review", tone: "primary", formAction: `/api/submittals/${sub.id}/submit` });
  if (sub.status === "UNDER_REVIEW" && actor.isManager) {
    actions.push({ name: "approve", label: "Approve", tone: "primary", formAction: `/api/submittals/${sub.id}/approve` });
    actions.push({ name: "reject", label: "Reject", tone: "danger", requireReason: true, formAction: `/api/submittals/${sub.id}/reject` });
  }

  return (
    <DetailShell
      eyebrow={`${sub.project.code} · Submittal`}
      title={`${sub.number} — ${sub.title}`}
      subtitle={sub.specSection ? `Spec section ${sub.specSection}` : undefined}
      crumbs={[{ label: "Projects", href: "/projects" }, { label: sub.project.code, href: `/projects/${sub.project.id}` }, { label: "Submittals", href: `/projects/${sub.project.id}/submittals` }, { label: sub.number }]}
      actions={<div className="flex gap-2 items-center"><StatusBadge status={sub.status} /><Link href={`/projects/${projectId}/submittals/${submittalId}/review`} className="btn-outline text-xs">AI · Review</Link></div>}
    >
      <section className="grid gap-4 md:grid-cols-4">
        <StatTile label="Status" value={sub.status.replaceAll("_", " ")} />
        <StatTile label="Long-lead" value={sub.longLead ? "Yes" : "No"} tone={sub.longLead ? "warn" : "default"} />
        <StatTile label="Spec section" value={sub.specSection ?? "—"} />
        <StatTile label="Number" value={sub.number} />
      </section>

      <section className="card p-6">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Submittal detail</div>
        <DetailGrid>
          <DetailField label="Number">{sub.number}</DetailField>
          <DetailField label="Title">{sub.title}</DetailField>
          <DetailField label="Spec section">{sub.specSection ?? "—"}</DetailField>
          <DetailField label="Long lead">{sub.longLead ? "Yes" : "No"}</DetailField>
          <DetailField label="Submitted">{formatDate(sub.submittedAt)}{sub.submittedBy ? ` by ${sub.submittedBy}` : ""}</DetailField>
          <DetailField label="Approved">{formatDate(sub.approvedAt)}{sub.approvedBy ? ` by ${sub.approvedBy}` : ""}</DetailField>
          <DetailField label="Rejected">{formatDate(sub.rejectedAt)}{sub.rejectedBy ? ` by ${sub.rejectedBy}` : ""}</DetailField>
          {sub.notes ? <DetailField label="Notes">{sub.notes}</DetailField> : null}
          {sub.approvalNote ? <DetailField label="Approval note">{sub.approvalNote}</DetailField> : null}
          {sub.rejectionReason ? <DetailField label="Rejection reason"><span className="text-rose-200">{sub.rejectionReason}</span></DetailField> : null}
        </DetailGrid>
      </section>

      <ApprovalSection title="Actions" status={sub.status} actions={actions} actorName={actor.userName} actorRole={actor.role} isManager={actor.isManager} />

      {actor.canEdit && sub.status !== "APPROVED" ? (
        <section className="card p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Edit submittal</div>
          <form action={`/api/submittals/${sub.id}/edit`} method="post" className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="md:col-span-2"><label className="form-label">Title</label><input name="title" defaultValue={sub.title} className="form-input" /></div>
            <div><label className="form-label">Spec section</label><input name="specSection" defaultValue={sub.specSection ?? ""} className="form-input" /></div>
            <div><label className="form-label">Long lead</label><select name="longLead" defaultValue={sub.longLead ? "true" : "false"} className="form-select"><option value="false">No</option><option value="true">Yes</option></select></div>
            <div className="md:col-span-3"><label className="form-label">Notes</label><textarea name="notes" defaultValue={sub.notes ?? ""} rows={2} className="form-textarea" /></div>
            <div className="md:col-span-3"><button className="btn-primary">Save changes</button></div>
          </form>
        </section>
      ) : null}

      <ActivityTrail comments={comments} commentAction={`/api/records/Submittal/${sub.id}/comment`} />
    </DetailShell>
  );
}
