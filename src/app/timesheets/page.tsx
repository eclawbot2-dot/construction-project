import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatTile } from "@/components/ui/stat-tile";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function TimesheetsRollupPage() {
  const entries = await prisma.timeEntry.findMany({ include: { project: true }, orderBy: [{ weekEnding: "desc" }, { employeeName: "asc" }], take: 500 });
  const totalHours = entries.reduce((s, t) => s + t.regularHours + t.overtimeHours + t.doubleTimeHours, 0);
  const totalCost = entries.reduce((s, t) => s + (t.regularHours * t.rate + t.overtimeHours * t.rate * 1.5 + t.doubleTimeHours * t.rate * 2), 0);
  const pending = entries.filter((t) => t.status === "SUBMITTED" || t.status === "DRAFT").length;

  return (
    <AppLayout eyebrow="Labor" title="Timesheets — portfolio" description="Weekly time cards across every project with loaded labor cost rollup.">
      <div className="grid gap-6">
        <section className="grid gap-4 md:grid-cols-4">
          <StatTile label="Entries (500 most recent)" value={entries.length} />
          <StatTile label="Logged hours" value={totalHours.toLocaleString()} />
          <StatTile label="Loaded labor" value={formatCurrency(totalCost)} />
          <StatTile label="Pending approval" value={pending} tone={pending > 0 ? "warn" : "good"} />
        </section>
        <section className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-white/5">
                <tr>
                  <th className="table-header">Project</th>
                  <th className="table-header">Employee</th>
                  <th className="table-header">Week ending</th>
                  <th className="table-header">Reg</th>
                  <th className="table-header">OT</th>
                  <th className="table-header">DT</th>
                  <th className="table-header">Loaded</th>
                  <th className="table-header">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-slate-950/40">
                {entries.map((t) => {
                  const loaded = t.regularHours * t.rate + t.overtimeHours * t.rate * 1.5 + t.doubleTimeHours * t.rate * 2;
                  return (
                    <tr key={t.id}>
                      <td className="table-cell"><Link href={`/projects/${t.project.id}/timesheets`} className="text-cyan-300 hover:underline">{t.project.code}</Link></td>
                      <td className="table-cell font-medium text-white">{t.employeeName}</td>
                      <td className="table-cell text-slate-400">{formatDate(t.weekEnding)}</td>
                      <td className="table-cell">{t.regularHours}</td>
                      <td className="table-cell">{t.overtimeHours}</td>
                      <td className="table-cell">{t.doubleTimeHours}</td>
                      <td className="table-cell">{formatCurrency(loaded)}</td>
                      <td className="table-cell"><StatusBadge status={t.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
