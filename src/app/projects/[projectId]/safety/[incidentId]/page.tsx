import { notFound } from "next/navigation";
import { DetailShell, DetailGrid, DetailField } from "@/components/layout/detail-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { formatDate } from "@/lib/utils";

export default async function IncidentDetailPage({ params }: { params: Promise<{ projectId: string; incidentId: string }> }) {
  const { projectId, incidentId } = await params;
  const tenant = await requireTenant();
  const incident = await prisma.safetyIncident.findFirst({
    where: { id: incidentId, project: { id: projectId, tenantId: tenant.id } },
    include: { project: true },
  });
  if (!incident) notFound();

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
          <DetailField label="Created">{formatDate(incident.createdAt)}</DetailField>
        </DetailGrid>
      </section>
    </DetailShell>
  );
}
