import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusBadge } from "@/components/ui/status-badge";
import { detectJournalAnomalies } from "@/lib/finance-ai";
import { requireTenant } from "@/lib/tenant";

export default async function AnomaliesPage() {
  const tenant = await requireTenant();
  const findings = await detectJournalAnomalies(tenant.id);
  const high = findings.filter((f) => f.severity === "HIGH").length;
  const med = findings.filter((f) => f.severity === "MED").length;
  const low = findings.filter((f) => f.severity === "LOW").length;

  return (
    <AppLayout eyebrow="Finance AI" title="Journal anomaly detector" description="Scans the last 90 days for duplicates, round amounts, and high-value entries. Flag anything suspicious for controller review.">
      <section className="grid gap-4 md:grid-cols-4">
        <StatTile label="Total findings" value={findings.length} />
        <StatTile label="High severity" value={high} tone={high > 0 ? "bad" : "good"} />
        <StatTile label="Medium" value={med} tone={med > 0 ? "warn" : "good"} />
        <StatTile label="Informational" value={low} />
      </section>
      <section className="card p-0 overflow-hidden">
        <table className="min-w-full divide-y divide-white/10 text-sm">
          <thead className="bg-white/5">
            <tr>
              <th className="table-header">Type</th>
              <th className="table-header">Severity</th>
              <th className="table-header">Description</th>
              <th className="table-header"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10 bg-slate-950/40">
            {findings.map((f, i) => (
              <tr key={i}>
                <td className="table-cell font-mono text-xs text-slate-400">{f.type}</td>
                <td className="table-cell"><StatusBadge status={f.severity} /></td>
                <td className="table-cell">{f.description}</td>
                <td className="table-cell"><Link href={`/finance/journal`} className="text-cyan-300 hover:underline text-xs">→ review</Link></td>
              </tr>
            ))}
            {findings.length === 0 ? <tr><td colSpan={4} className="table-cell text-center text-slate-500">No anomalies detected in the last 90 days.</td></tr> : null}
          </tbody>
        </table>
      </section>
    </AppLayout>
  );
}
