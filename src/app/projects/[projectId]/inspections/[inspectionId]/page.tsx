import { notFound } from "next/navigation";
import { DetailShell, DetailGrid, DetailField } from "@/components/layout/detail-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { formatDate, inspectionKindLabel } from "@/lib/utils";

export default async function InspectionDetailPage({ params }: { params: Promise<{ projectId: string; inspectionId: string }> }) {
  const { projectId, inspectionId } = await params;
  const tenant = await requireTenant();
  const inspection = await prisma.inspection.findFirst({
    where: { id: inspectionId, project: { id: projectId, tenantId: tenant.id } },
    include: { project: true },
  });
  if (!inspection) notFound();

  let checklist: string[] = [];
  try { const parsed = JSON.parse(inspection.checklistJson); checklist = Array.isArray(parsed) ? parsed : []; } catch { /* ignore */ }

  return (
    <DetailShell
      eyebrow={`${inspection.project.code} · Inspection`}
      title={inspection.title}
      subtitle={`${inspectionKindLabel(inspection.kind)} · ${inspection.inspector ?? "—"}`}
      crumbs={[{ label: "Projects", href: "/projects" }, { label: inspection.project.code, href: `/projects/${inspection.project.id}` }, { label: "Inspections", href: `/projects/${inspection.project.id}/inspections` }, { label: inspection.title }]}
      actions={<StatusBadge status={inspection.result} />}
    >
      <section className="card p-6">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Inspection detail</div>
        <DetailGrid>
          <DetailField label="Kind">{inspectionKindLabel(inspection.kind)}</DetailField>
          <DetailField label="Location">{inspection.location ?? "—"}</DetailField>
          <DetailField label="Inspector">{inspection.inspector ?? "—"}</DetailField>
          <DetailField label="Result">{inspection.result}</DetailField>
          <DetailField label="Scheduled">{formatDate(inspection.scheduledAt)}</DetailField>
          <DetailField label="Completed">{formatDate(inspection.completedAt)}</DetailField>
          <DetailField label="Follow-up needed">{inspection.followUpNeeded ? "Yes" : "No"}</DetailField>
          <DetailField label="Follow-up notes">{inspection.followUpNotes ?? "—"}</DetailField>
        </DetailGrid>
      </section>

      {checklist.length > 0 ? (
        <section className="card p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Checklist</div>
          <ul className="mt-4 grid gap-2 md:grid-cols-2">
            {checklist.map((item, i) => (
              <li key={i} className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">{item}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </DetailShell>
  );
}
