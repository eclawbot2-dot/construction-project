import { notFound } from "next/navigation";
import Link from "next/link";
import { DetailShell } from "@/components/layout/detail-shell";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { scheduleRiskScan } from "@/lib/execution-ai";

export default async function ScheduleRiskPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const tenant = await requireTenant();
  const project = await prisma.project.findFirst({ where: { id: projectId, tenantId: tenant.id } });
  if (!project) notFound();
  const flags = await scheduleRiskScan(projectId, tenant.id);
  const high = flags.filter((f) => f.risk === "HIGH").length;
  const med = flags.filter((f) => f.risk === "MED").length;

  return (
    <DetailShell
      eyebrow="AI · Schedule risk scan"
      title={`${project.code} — Slip projections`}
      subtitle={`Scanned schedule tasks for risk based on progress, dates, and critical path.`}
      crumbs={[{ label: "Projects", href: "/projects" }, { label: project.code, href: `/projects/${projectId}` }, { label: "Schedule", href: `/projects/${projectId}/schedule` }, { label: "Risk" }]}
    >
      <section className="grid gap-4 md:grid-cols-3">
        <StatTile label="High risk" value={high} tone={high > 0 ? "bad" : "good"} />
        <StatTile label="Medium risk" value={med} tone={med > 0 ? "warn" : "good"} />
        <StatTile label="Tasks flagged" value={flags.length} />
      </section>
      <section className="card p-0 overflow-hidden">
        <table className="min-w-full divide-y divide-white/10 text-sm">
          <thead className="bg-white/5">
            <tr>
              <th className="table-header">Task</th>
              <th className="table-header">Risk</th>
              <th className="table-header">Predicted slip (days)</th>
              <th className="table-header">Why</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10 bg-slate-950/40">
            {flags.map((f, i) => (
              <tr key={i}>
                <td className="table-cell">{f.taskTitle}</td>
                <td className="table-cell"><StatusBadge status={f.risk} /></td>
                <td className="table-cell">{f.daysSlipPredicted}</td>
                <td className="table-cell text-xs text-slate-400">{f.reason}</td>
              </tr>
            ))}
            {flags.length === 0 ? <tr><td colSpan={4} className="table-cell text-center text-slate-500">No tasks at risk — schedule trending on baseline.</td></tr> : null}
          </tbody>
        </table>
      </section>
      <Link href={`/projects/${projectId}/schedule`} className="btn-outline text-xs">← back</Link>
    </DetailShell>
  );
}
