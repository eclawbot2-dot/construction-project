import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatTile } from "@/components/ui/stat-tile";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { formatDate, inspectionKindLabel } from "@/lib/utils";

export default async function SafetyDashboardPage() {
  const tenant = await requireTenant();
  const [incidents, inspections] = await Promise.all([
    prisma.safetyIncident.findMany({ where: { project: { tenantId: tenant.id } }, include: { project: true }, orderBy: { occurredAt: "desc" }, take: 100 }),
    prisma.inspection.findMany({ where: { project: { tenantId: tenant.id }, OR: [{ kind: "OSHA" }, { kind: "ENVIRONMENTAL" }] }, include: { project: true }, orderBy: { scheduledAt: "desc" }, take: 100 }),
  ]);
  const failed = inspections.filter((i) => i.result === "FAIL").length;
  const scheduled = inspections.filter((i) => !i.completedAt).length;

  return (
    <AppLayout eyebrow="Safety & compliance" title="Safety dashboard" description="Incidents, near-misses, OSHA and environmental inspections across every active project.">
      <div className="grid gap-6">
        <section className="grid gap-4 md:grid-cols-4">
          <StatTile label="Incidents (last 100)" value={incidents.length} />
          <StatTile label="OSHA inspections" value={inspections.length} />
          <StatTile label="Failed" value={failed} tone={failed > 0 ? "bad" : "good"} />
          <StatTile label="Scheduled" value={scheduled} tone={scheduled > 0 ? "warn" : "good"} />
        </section>
        <section className="card p-0 overflow-hidden">
          <div className="px-5 py-3 text-xs uppercase tracking-[0.2em] text-slate-400">Incident log</div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-white/5">
                <tr>
                  <th className="table-header">Project</th>
                  <th className="table-header">Title</th>
                  <th className="table-header">Severity</th>
                  <th className="table-header">Occurred</th>
                  <th className="table-header">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-slate-950/40">
                {incidents.map((i) => (
                  <tr key={i.id} className="cursor-pointer transition hover:bg-white/5">
                    <td className="table-cell"><Link href={`/projects/${i.project.id}/safety`} className="text-cyan-300 hover:underline">{i.project.code}</Link></td>
                    <td className="table-cell"><Link href={`/projects/${i.project.id}/safety/${i.id}`} className="text-cyan-300 hover:text-cyan-200 hover:underline">{i.title}</Link></td>
                    <td className="table-cell">{i.severity}</td>
                    <td className="table-cell text-slate-400">{formatDate(i.occurredAt)}</td>
                    <td className="table-cell"><StatusBadge status={i.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="card p-0 overflow-hidden">
          <div className="px-5 py-3 text-xs uppercase tracking-[0.2em] text-slate-400">OSHA & environmental inspections</div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-white/5">
                <tr>
                  <th className="table-header">Project</th>
                  <th className="table-header">Kind</th>
                  <th className="table-header">Title</th>
                  <th className="table-header">Scheduled</th>
                  <th className="table-header">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-slate-950/40">
                {inspections.map((i) => (
                  <tr key={i.id} className="cursor-pointer transition hover:bg-white/5">
                    <td className="table-cell"><Link href={`/projects/${i.project.id}/inspections`} className="text-cyan-300 hover:underline">{i.project.code}</Link></td>
                    <td className="table-cell">{inspectionKindLabel(i.kind)}</td>
                    <td className="table-cell"><Link href={`/projects/${i.project.id}/inspections/${i.id}`} className="text-cyan-300 hover:text-cyan-200 hover:underline">{i.title}</Link></td>
                    <td className="table-cell text-slate-400">{formatDate(i.scheduledAt)}</td>
                    <td className="table-cell"><StatusBadge status={i.result} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
