import { notFound } from "next/navigation";
import Link from "next/link";
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
    include: {
      project: true,
      permit: true,
      checklistItems: { orderBy: { position: "asc" } },
      attachments: true,
    },
  });
  if (!inspection) notFound();

  const legacyChecklist: string[] = (() => {
    if (inspection.checklistItems.length > 0) return [];
    try { const parsed = JSON.parse(inspection.checklistJson); return Array.isArray(parsed) ? parsed.map(String) : []; } catch { return []; }
  })();

  return (
    <DetailShell
      eyebrow={`${inspection.project.code} · Inspection`}
      title={inspection.title}
      subtitle={`${inspectionKindLabel(inspection.kind)} · ${inspection.inspector ?? "—"}`}
      crumbs={[{ label: "Projects", href: "/projects" }, { label: inspection.project.code, href: `/projects/${inspection.project.id}` }, { label: "Inspections", href: `/projects/${inspection.project.id}/inspections` }, { label: inspection.title }]}
      actions={(
        <div className="flex items-center gap-2">
          <StatusBadge status={inspection.result} />
          {inspection.result === "FAIL" || inspection.result === "CONDITIONAL" ? (
            <form action={`/api/inspections/${inspection.id}/create-punch`} method="post">
              <input type="hidden" name="redirect" value={`/projects/${inspection.project.id}/inspections/${inspection.id}`} />
              <button className="btn-primary text-xs">Create punch item →</button>
            </form>
          ) : null}
        </div>
      )}
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
          <DetailField label="Source">{inspection.sourceSystem ?? "manual"}</DetailField>
          <DetailField label="External ID">{inspection.externalId ?? "—"}</DetailField>
          <DetailField label="Permit">{inspection.permit ? <Link href={`/projects/${inspection.project.id}/permits`} className="text-cyan-300 hover:underline">{inspection.permit.permitNumber}</Link> : "—"}</DetailField>
          <DetailField label="Follow-up needed">{inspection.followUpNeeded ? "Yes" : "No"}</DetailField>
          <DetailField label="Follow-up notes">{inspection.followUpNotes ?? "—"}</DetailField>
        </DetailGrid>
      </section>

      {inspection.checklistItems.length > 0 ? (
        <section className="card p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Checklist</div>
          <div className="mt-4 space-y-2">
            {inspection.checklistItems.map((item) => (
              <div key={item.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-white">{item.title}</span>
                      <StatusBadge status={item.status} />
                      {item.codeReference ? <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">{item.codeReference}</span> : null}
                    </div>
                    {item.notes ? <div className="mt-1 text-sm text-slate-400">{item.notes}</div> : null}
                  </div>
                  {item.status === "FAIL" ? (
                    <form action={`/api/inspections/${inspection.id}/create-punch`} method="post">
                      <input type="hidden" name="itemId" value={item.id} />
                      <input type="hidden" name="redirect" value={`/projects/${inspection.project.id}/inspections/${inspection.id}`} />
                      <button className="btn-outline text-xs">Punch this</button>
                    </form>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : legacyChecklist.length > 0 ? (
        <section className="card p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Checklist (legacy)</div>
          <ul className="mt-4 grid gap-2 md:grid-cols-2">
            {legacyChecklist.map((item, i) => (
              <li key={i} className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {inspection.attachments.length > 0 ? (
        <section className="card p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Attachments</div>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {inspection.attachments.map((a) => (
              <a key={a.id} href={a.url} target="_blank" rel="noopener" className="panel p-3 text-sm text-cyan-300 hover:text-cyan-200">
                {a.label} <span className="text-slate-500">· {a.contentType ?? "file"}</span>
              </a>
            ))}
          </div>
        </section>
      ) : null}
    </DetailShell>
  );
}
