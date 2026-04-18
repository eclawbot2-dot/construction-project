import { notFound } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { ProjectTabs } from "@/components/layout/project-tabs";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatTile } from "@/components/ui/stat-tile";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function TimesheetsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { timeEntries: { orderBy: [{ weekEnding: "desc" }, { employeeName: "asc" }] } },
  });
  if (!project) notFound();

  const totalHours = project.timeEntries.reduce((s, t) => s + t.regularHours + t.overtimeHours + t.doubleTimeHours, 0);
  const totalDollars = project.timeEntries.reduce((s, t) => s + (t.regularHours * t.rate + t.overtimeHours * t.rate * 1.5 + t.doubleTimeHours * t.rate * 2), 0);
  const pending = project.timeEntries.filter((t) => t.status === "SUBMITTED" || t.status === "DRAFT").length;

  return (
    <AppLayout eyebrow={`${project.code} · Timesheets`} title={project.name} description="Weekly crew timesheets with regular, overtime, and double-time hours tied to cost codes.">
      <div className="grid gap-6">
        <ProjectTabs projectId={project.id} active="timesheets" />
        <section className="grid gap-4 md:grid-cols-4">
          <StatTile label="Entries" value={project.timeEntries.length} />
          <StatTile label="Total hours" value={totalHours.toLocaleString()} />
          <StatTile label="Labor cost (loaded)" value={formatCurrency(totalDollars)} />
          <StatTile label="Pending approval" value={pending} tone={pending > 0 ? "warn" : "good"} />
        </section>
        <section className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-white/5">
                <tr>
                  <th className="table-header">Employee</th>
                  <th className="table-header">Trade</th>
                  <th className="table-header">Week ending</th>
                  <th className="table-header">Reg</th>
                  <th className="table-header">OT</th>
                  <th className="table-header">DT</th>
                  <th className="table-header">Rate</th>
                  <th className="table-header">Loaded cost</th>
                  <th className="table-header">Cost code</th>
                  <th className="table-header">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-slate-950/40">
                {project.timeEntries.map((t) => {
                  const loaded = t.regularHours * t.rate + t.overtimeHours * t.rate * 1.5 + t.doubleTimeHours * t.rate * 2;
                  return (
                    <tr key={t.id}>
                      <td className="table-cell font-medium text-white">{t.employeeName}</td>
                      <td className="table-cell text-slate-400">{t.trade ?? "—"}</td>
                      <td className="table-cell text-slate-400">{formatDate(t.weekEnding)}</td>
                      <td className="table-cell">{t.regularHours}</td>
                      <td className="table-cell">{t.overtimeHours}</td>
                      <td className="table-cell">{t.doubleTimeHours}</td>
                      <td className="table-cell">{formatCurrency(t.rate)}/h</td>
                      <td className="table-cell">{formatCurrency(loaded)}</td>
                      <td className="table-cell font-mono text-xs">{t.costCode ?? "—"}</td>
                      <td className="table-cell"><StatusBadge status={t.status} /></td>
                    </tr>
                  );
                })}
                {project.timeEntries.length === 0 ? <tr><td colSpan={10} className="table-cell text-center text-slate-500">No time entries.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
