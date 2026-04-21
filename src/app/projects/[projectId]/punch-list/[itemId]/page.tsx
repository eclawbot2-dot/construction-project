import { notFound } from "next/navigation";
import { DetailShell, DetailGrid, DetailField } from "@/components/layout/detail-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { ApprovalSection, ActivityTrail } from "@/components/approval-section";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { currentActor } from "@/lib/permissions";
import { listComments } from "@/lib/approvals";
import { formatDate } from "@/lib/utils";

export default async function PunchItemDetailPage({ params }: { params: Promise<{ projectId: string; itemId: string }> }) {
  const { projectId, itemId } = await params;
  const tenant = await requireTenant();
  const actor = await currentActor(tenant.id);
  const item = await prisma.punchItem.findFirst({
    where: { id: itemId, project: { id: projectId, tenantId: tenant.id } },
    include: { project: true },
  });
  if (!item) notFound();
  const comments = await listComments(tenant.id, "PunchItem", item.id);

  const dueIso = item.dueDate ? new Date(item.dueDate).toISOString().slice(0, 10) : "";
  const actions: Array<{ name: string; label: string; tone: "primary" | "outline" | "danger"; requireReason?: boolean; formAction: string }> = [];
  if (item.status === "DRAFT" && actor.canEdit) actions.push({ name: "submit", label: "Ready for verification", tone: "primary", formAction: `/api/punch-items/${item.id}/submit` });
  if (item.status === "UNDER_REVIEW" && actor.isManager) {
    actions.push({ name: "close", label: "Verify & close", tone: "primary", formAction: `/api/punch-items/${item.id}/close` });
    actions.push({ name: "reject", label: "Reject — needs rework", tone: "danger", requireReason: true, formAction: `/api/punch-items/${item.id}/reject` });
  }

  return (
    <DetailShell
      eyebrow={`${item.project.code} · Punch item`}
      title={item.title}
      crumbs={[{ label: "Projects", href: "/projects" }, { label: item.project.code, href: `/projects/${item.project.id}` }, { label: "Punch list", href: `/projects/${item.project.id}/punch-list` }, { label: item.title }]}
      actions={<StatusBadge status={item.status} />}
    >
      <section className="card p-6">
        <DetailGrid>
          <DetailField label="Title">{item.title}</DetailField>
          <DetailField label="Area">{item.area ?? "—"}</DetailField>
          <DetailField label="Trade">{item.trade ?? "—"}</DetailField>
          <DetailField label="Assigned to">{item.assignedTo ?? "—"}</DetailField>
          <DetailField label="Due">{formatDate(item.dueDate)}</DetailField>
          <DetailField label="Closed">{formatDate(item.closedAt)}{item.closedBy ? ` by ${item.closedBy}` : ""}</DetailField>
          {item.description ? <DetailField label="Description">{item.description}</DetailField> : null}
          {item.approvalNote ? <DetailField label="Close note">{item.approvalNote}</DetailField> : null}
          {item.rejectionReason ? <DetailField label="Reject reason"><span className="text-rose-200">{item.rejectionReason}</span></DetailField> : null}
        </DetailGrid>
      </section>

      <ApprovalSection title="Actions" status={item.status} actions={actions} actorName={actor.userName} actorRole={actor.role} isManager={actor.isManager} />

      {actor.canEdit && item.status !== "CLOSED" ? (
        <section className="card p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Edit punch item</div>
          <form action={`/api/punch-items/${item.id}/edit`} method="post" className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="md:col-span-2"><label className="form-label">Title</label><input name="title" defaultValue={item.title} className="form-input" /></div>
            <div><label className="form-label">Area</label><input name="area" defaultValue={item.area ?? ""} className="form-input" /></div>
            <div><label className="form-label">Trade</label><input name="trade" defaultValue={item.trade ?? ""} className="form-input" /></div>
            <div><label className="form-label">Assigned to</label><input name="assignedTo" defaultValue={item.assignedTo ?? ""} className="form-input" /></div>
            <div><label className="form-label">Due date</label><input name="dueDate" type="date" defaultValue={dueIso} className="form-input" /></div>
            <div className="md:col-span-3"><label className="form-label">Description</label><textarea name="description" defaultValue={item.description ?? ""} rows={3} className="form-textarea" /></div>
            <div className="md:col-span-3"><button className="btn-primary">Save changes</button></div>
          </form>
        </section>
      ) : null}

      <ActivityTrail comments={comments} commentAction={`/api/records/PunchItem/${item.id}/comment`} />
    </DetailShell>
  );
}
