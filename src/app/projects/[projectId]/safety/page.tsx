import { notFound } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { ProjectTabs } from "@/components/layout/project-tabs";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";

export default async function SafetyPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { safetyIncidents: { orderBy: { occurredAt: "desc" } } },
  });
  if (!project) notFound();

  const bySeverity = project.safetyIncidents.reduce<Record<string, number>>((acc, i) => { acc[i.severity] = (acc[i.severity] ?? 0) + 1; return acc; }, {});

  return (
    <AppLayout eyebrow={`${project.code} · Safety`} title={project.name} description="Incident reports, near-misses, OSHA tracking.">
      <div className="grid gap-6">
        <ProjectTabs projectId={project.id} active="safety" />
        <section className="grid gap-4 md:grid-cols-4">
          <Stat label="Total incidents" value={project.safetyIncidents.length} />
          <Stat label="Minor" value={bySeverity.minor ?? bySeverity.MINOR ?? 0} />
          <Stat label="Near-miss" value={bySeverity["near-miss"] ?? bySeverity.NEAR_MISS ?? 0} tone="warn" />
          <Stat label="Recordable" value={bySeverity.recordable ?? bySeverity.RECORDABLE ?? 0} tone="bad" />
        </section>
        <section className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-white/5">
                <tr>
                  <th className="table-header">Title</th>
                  <th className="table-header">Severity</th>
                  <th className="table-header">Occurred</th>
                  <th className="table-header">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-slate-950/40">
                {project.safetyIncidents.map((i) => (
                  <tr key={i.id}>
                    <td className="table-cell">{i.title}</td>
                    <td className="table-cell">{i.severity}</td>
                    <td className="table-cell text-slate-400">{formatDate(i.occurredAt)}</td>
                    <td className="table-cell"><StatusBadge status={i.status} /></td>
                  </tr>
                ))}
                {project.safetyIncidents.length === 0 ? <tr><td colSpan={4} className="table-cell text-center text-slate-500">No incidents logged.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: "good" | "warn" | "bad" }) {
  const toneClass = tone === "good" ? "text-emerald-300" : tone === "warn" ? "text-amber-300" : tone === "bad" ? "text-rose-300" : "text-white";
  return <div className="panel p-4"><div className="text-xs uppercase tracking-[0.16em] text-slate-400">{label}</div><div className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</div></div>;
}
