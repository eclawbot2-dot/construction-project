import { notFound } from "next/navigation";
import { DetailShell, DetailGrid, DetailField } from "@/components/layout/detail-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { ApprovalSection, ActivityTrail } from "@/components/approval-section";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { currentActor } from "@/lib/permissions";
import { listComments } from "@/lib/approvals";
import { formatDate } from "@/lib/utils";

export default async function IncidentDetailPage({ params }: { params: Promise<{ projectId: string; incidentId: string }> }) {
  const { projectId, incidentId } = await params;
  const tenant = await requireTenant();
  const actor = await currentActor(tenant.id);
  const incident = await prisma.safetyIncident.findFirst({
    where: { id: incidentId, project: { id: projectId, tenantId: tenant.id } },
    include: { project: true },
  });
  if (!incident) notFound();
  const comments = await listComments(tenant.id, "SafetyIncident", incident.id);

  const actions: Array<{ name: string; label: string; tone: "primary" | "outline" | "danger"; requireReason?: boolean; formAction: string }> = [];
  if (incident.status === "DRAFT" && actor.canEdit) actions.push({ name: "submit", label: "Submit for review", tone: "primary", formAction: `/api/safety-incidents/${incident.id}/submit` });
  if (incident.status === "UNDER_REVIEW" && actor.isManager) actions.push({ name: "approve", label: "Close & sign off", tone: "primary", formAction: `/api/safety-incidents/${incident.id}/approve` });

  return (
    <DetailShell
      eyebrow={`${incident.project.code} · Safety incident`}
      title={incident.title}
      crumbs={[{ label: "Projects", href: "/projects" }, { label: incident.project.code, href: `/projects/${incident.project.id}` }, { label: "Safety", href: `/projects/${incident.project.id}/safety` }, { label: incident.title }]}
      actions={<StatusBadge status={incident.status} />}
    >
      <section className="card p-6">
        <DetailGrid>
          <DetailField label="Title">{incident.title}</DetailField>
          <DetailField label="Severity">{incident.severity}</DetailField>
          <DetailField label="Occurred">{formatDate(incident.occurredAt)}</DetailField>
          <DetailField label="Status">{incident.status.replaceAll("_", " ")}</DetailField>
          <DetailField label="Submitted">{formatDate(incident.submittedAt)}{incident.submittedBy ? ` by ${incident.submittedBy}` : ""}</DetailField>
          <DetailField label="Signed off">{formatDate(incident.approvedAt)}{incident.approvedBy ? ` by ${incident.approvedBy}` : ""}</DetailField>
          {incident.description ? <DetailField label="Description">{incident.description}</DetailField> : null}
          {incident.correctiveActions ? <DetailField label="Corrective actions">{incident.correctiveActions}</DetailField> : null}
          {incident.approvalNote ? <DetailField label="Sign-off note">{incident.approvalNote}</DetailField> : null}
        </DetailGrid>
      </section>

      <ApprovalSection title="Actions" status={incident.status} actions={actions} actorName={actor.userName} actorRole={actor.role} isManager={actor.isManager} />

      {actor.canEdit && incident.status !== "APPROVED" ? (
        <section className="card p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Edit incident</div>
          <form action={`/api/safety-incidents/${incident.id}/edit`} method="post" className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="md:col-span-2"><label className="form-label">Title</label><input name="title" defaultValue={incident.title} className="form-input" /></div>
            <div><label className="form-label">Severity</label><input name="severity" defaultValue={incident.severity} className="form-input" /></div>
            <div className="md:col-span-3"><label className="form-label">Description</label><textarea name="description" defaultValue={incident.description ?? ""} rows={3} className="form-textarea" /></div>
            <div className="md:col-span-3"><label className="form-label">Corrective actions</label><textarea name="correctiveActions" defaultValue={incident.correctiveActions ?? ""} rows={3} className="form-textarea" /></div>
            <div className="md:col-span-3"><button className="btn-primary">Save changes</button></div>
          </form>
        </section>
      ) : null}

      <ActivityTrail comments={comments} commentAction={`/api/records/SafetyIncident/${incident.id}/comment`} />
    </DetailShell>
  );
}
