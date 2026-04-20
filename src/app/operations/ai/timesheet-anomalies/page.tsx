import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusBadge } from "@/components/ui/status-badge";
import { timesheetAnomalies } from "@/lib/ops-ai";
import { requireTenant } from "@/lib/tenant";
import { formatDate } from "@/lib/utils";

export default async function TimesheetAnomaliesPage() {
  const tenant = await requireTenant();
  const flags = await timesheetAnomalies(tenant.id);
  const high = flags.filter((f) => f.severity === "HIGH").length;

  return (
    <AppLayout eyebrow="Ops AI" title="Timesheet anomaly detector" description="Scan past 90 days for impossible hours, multi-project conflicts, and likely data-entry errors.">
      <section className="grid gap-4 md:grid-cols-3">
        <StatTile label="Anomalies" value={flags.length} />
        <StatTile label="High" value={high} tone={high > 0 ? "bad" : "good"} />
        <StatTile label="Medium" value={flags.length - high} tone={flags.length - high > 0 ? "warn" : "good"} />
      </section>
      <section className="card p-0 overflow-hidden">
        <table className="min-w-full divide-y divide-white/10 text-sm">
          <thead className="bg-white/5">
            <tr><th className="table-header">Employee</th><th className="table-header">Week</th><th className="table-header">Severity</th><th className="table-header">Issue</th></tr>
          </thead>
          <tbody className="divide-y divide-white/10 bg-slate-950/40">
            {flags.map((f, i) => (
              <tr key={i}>
                <td className="table-cell">{f.userName}</td>
                <td className="table-cell text-xs text-slate-400">{formatDate(f.date)}</td>
                <td className="table-cell"><StatusBadge status={f.severity} /></td>
                <td className="table-cell text-xs text-slate-300">{f.issue}</td>
              </tr>
            ))}
            {flags.length === 0 ? <tr><td colSpan={4} className="table-cell text-center text-slate-500">No timesheet anomalies in the last 90 days.</td></tr> : null}
          </tbody>
        </table>
      </section>
      <Link href="/operations/ai" className="btn-outline text-xs">← back</Link>
    </AppLayout>
  );
}
