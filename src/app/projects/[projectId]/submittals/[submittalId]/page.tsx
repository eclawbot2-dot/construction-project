import { notFound } from "next/navigation";
import { DetailShell, DetailGrid, DetailField } from "@/components/layout/detail-shell";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { formatDate } from "@/lib/utils";

export default async function SubmittalDetailPage({ params }: { params: Promise<{ projectId: string; submittalId: string }> }) {
  const { projectId, submittalId } = await params;
  const tenant = await requireTenant();
  const sub = await prisma.submittal.findFirst({
    where: { id: submittalId, project: { id: projectId, tenantId: tenant.id } },
    include: { project: true },
  });
  if (!sub) notFound();

  return (
    <DetailShell
      eyebrow={`${sub.project.code} · Submittal`}
      title={`${sub.number} — ${sub.title}`}
      subtitle={sub.specSection ? `Spec section ${sub.specSection}` : undefined}
      crumbs={[{ label: "Projects", href: "/projects" }, { label: sub.project.code, href: `/projects/${sub.project.id}` }, { label: "Submittals", href: `/projects/${sub.project.id}/submittals` }, { label: sub.number }]}
      actions={<StatusBadge status={sub.status} />}
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
          <DetailField label="Status">{sub.status.replaceAll("_", " ")}</DetailField>
          <DetailField label="Created">{formatDate(sub.createdAt)}</DetailField>
          <DetailField label="Updated">{formatDate(sub.updatedAt)}</DetailField>
        </DetailGrid>
      </section>
    </DetailShell>
  );
}
