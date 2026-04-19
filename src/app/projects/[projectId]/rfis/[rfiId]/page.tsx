import { notFound } from "next/navigation";
import { DetailShell, DetailGrid, DetailField } from "@/components/layout/detail-shell";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { formatDate } from "@/lib/utils";

export default async function RfiDetailPage({ params }: { params: Promise<{ projectId: string; rfiId: string }> }) {
  const { projectId, rfiId } = await params;
  const tenant = await requireTenant();
  const rfi = await prisma.rFI.findFirst({
    where: { id: rfiId, project: { id: projectId, tenantId: tenant.id } },
    include: { project: true },
  });
  if (!rfi) notFound();

  const ageDays = Math.round((Date.now() - new Date(rfi.createdAt).getTime()) / (1000 * 60 * 60 * 24));
  const overdue = rfi.dueDate && new Date(rfi.dueDate) < new Date() && rfi.status !== "CLOSED" && rfi.status !== "APPROVED";

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
        <StatTile label="Status" value={rfi.status.replaceAll("_", " ")} />
      </section>

      <section className="card p-6">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-400">RFI detail</div>
        <DetailGrid>
          <DetailField label="Number">{rfi.number}</DetailField>
          <DetailField label="Subject">{rfi.subject}</DetailField>
          <DetailField label="Status">{rfi.status.replaceAll("_", " ")}</DetailField>
          <DetailField label="Ball in court">{rfi.ballInCourt ?? "—"}</DetailField>
          <DetailField label="Due">{formatDate(rfi.dueDate)}</DetailField>
          <DetailField label="Created">{formatDate(rfi.createdAt)}</DetailField>
          <DetailField label="Updated">{formatDate(rfi.updatedAt)}</DetailField>
        </DetailGrid>
      </section>
    </DetailShell>
  );
}
