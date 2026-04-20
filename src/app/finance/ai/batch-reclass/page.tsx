import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { StatTile } from "@/components/ui/stat-tile";
import { batchReclassifySuggest } from "@/lib/finance-ai";
import { requireTenant } from "@/lib/tenant";

export default async function BatchReclassPage() {
  const tenant = await requireTenant();
  const suggestions = await batchReclassifySuggest(tenant.id);
  const high = suggestions.filter((s) => s.confidence >= 80).length;

  return (
    <AppLayout eyebrow="Finance AI" title="Batch reclassify" description={`${suggestions.length} unreconciled journal rows reviewed; AI suggests project + cost code mapping with confidence.`}>
      <section className="grid gap-4 md:grid-cols-3">
        <StatTile label="Suggestions" value={suggestions.length} />
        <StatTile label="High confidence (≥ 80%)" value={high} tone="good" />
        <StatTile label="Needs review" value={suggestions.length - high} tone="warn" />
      </section>
      <section className="card p-0 overflow-hidden">
        <table className="min-w-full divide-y divide-white/10 text-sm">
          <thead className="bg-white/5">
            <tr>
              <th className="table-header">Current project</th>
              <th className="table-header">→ Suggested</th>
              <th className="table-header">Current code</th>
              <th className="table-header">→ Suggested</th>
              <th className="table-header">Confidence</th>
              <th className="table-header">Why</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10 bg-slate-950/40">
            {suggestions.map((s) => (
              <tr key={s.journalId}>
                <td className="table-cell">{s.currentProject ?? "—"}</td>
                <td className="table-cell font-semibold text-white">{s.suggestedProject ?? "—"}</td>
                <td className="table-cell font-mono text-xs">{s.currentCostCode ?? "—"}</td>
                <td className="table-cell font-mono text-xs text-emerald-200">{s.suggestedCostCode ?? "—"}</td>
                <td className="table-cell">{s.confidence}%</td>
                <td className="table-cell text-xs text-slate-400">{s.rationale}</td>
              </tr>
            ))}
            {suggestions.length === 0 ? <tr><td colSpan={6} className="table-cell text-center text-slate-500">No unreconciled entries — all journals reviewed.</td></tr> : null}
          </tbody>
        </table>
      </section>
      <Link href="/finance/journal" className="btn-outline text-xs">→ go to journal page to apply</Link>
    </AppLayout>
  );
}
