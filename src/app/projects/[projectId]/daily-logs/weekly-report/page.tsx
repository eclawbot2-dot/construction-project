import { notFound } from "next/navigation";
import Link from "next/link";
import { DetailShell } from "@/components/layout/detail-shell";
import { StatTile } from "@/components/ui/stat-tile";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { weeklyOwnerReport } from "@/lib/execution-ai";

export default async function WeeklyReportPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const tenant = await requireTenant();
  const project = await prisma.project.findFirst({ where: { id: projectId, tenantId: tenant.id } });
  if (!project) notFound();
  const report = await weeklyOwnerReport(projectId, tenant.id);

  return (
    <DetailShell
      eyebrow="AI · Weekly owner report"
      title={`${project.code} — Weekly summary`}
      subtitle={report.period}
      crumbs={[{ label: "Projects", href: "/projects" }, { label: project.code, href: `/projects/${projectId}` }, { label: "Daily logs", href: `/projects/${projectId}/daily-logs` }, { label: "Weekly report" }]}
    >
      <section className="grid gap-4 md:grid-cols-4">
        <StatTile label="Logs reviewed" value={report.photos} />
        <StatTile label="Progress items" value={report.progress.length} tone="good" />
        <StatTile label="Delays" value={report.delays.length} tone={report.delays.length > 2 ? "warn" : "good"} />
        <StatTile label="Risks flagged" value={report.risks.length} tone={report.risks.length > 0 ? "warn" : "good"} />
      </section>
      <section className="card p-6">
        <div className="text-xs uppercase tracking-[0.2em] text-emerald-300">Progress</div>
        <ul className="mt-3 space-y-1 text-sm text-slate-200 list-disc pl-5">{report.progress.map((p, i) => <li key={i}>{p}</li>)}</ul>
      </section>
      <section className="card p-6">
        <div className="text-xs uppercase tracking-[0.2em] text-amber-300">Delays</div>
        <ul className="mt-3 space-y-1 text-sm text-slate-200 list-disc pl-5">{report.delays.map((p, i) => <li key={i}>{p}</li>)}</ul>
      </section>
      <section className="card p-6">
        <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Upcoming</div>
        <ul className="mt-3 space-y-1 text-sm text-slate-200 list-disc pl-5">{report.upcoming.map((p, i) => <li key={i}>{p}</li>)}</ul>
      </section>
      <section className="card p-6">
        <div className="text-xs uppercase tracking-[0.2em] text-rose-300">Risks</div>
        <ul className="mt-3 space-y-1 text-sm text-slate-200 list-disc pl-5">{report.risks.map((p, i) => <li key={i}>{p}</li>)}</ul>
      </section>
      <Link href={`/projects/${projectId}/daily-logs`} className="btn-outline text-xs">← back</Link>
    </DetailShell>
  );
}
