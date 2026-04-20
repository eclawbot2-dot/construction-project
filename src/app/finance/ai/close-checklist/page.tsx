import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusBadge } from "@/components/ui/status-badge";
import { monthEndCloseChecklist } from "@/lib/finance-ai";
import { requireTenant } from "@/lib/tenant";

export default async function CloseChecklistPage() {
  const tenant = await requireTenant();
  const items = await monthEndCloseChecklist(tenant.id);
  const complete = items.filter((i) => i.status === "COMPLETE").length;
  const blocked = items.filter((i) => i.status === "BLOCKED").length;

  return (
    <AppLayout eyebrow="Finance AI" title="Month-end close assistant" description="AI auto-checks standard close steps. Green = verified by live data. Blocked = resolve before signoff.">
      <section className="grid gap-4 md:grid-cols-4">
        <StatTile label="Steps complete" value={`${complete}/${items.length}`} tone={complete === items.length ? "good" : "warn"} />
        <StatTile label="Blocked" value={blocked} tone={blocked > 0 ? "bad" : "good"} />
        <StatTile label="Ready to verify" value={items.filter((i) => i.status === "READY").length} />
        <StatTile label="Pending" value={items.filter((i) => i.status === "PENDING").length} />
      </section>
      <section className="card p-0 overflow-hidden">
        <table className="min-w-full divide-y divide-white/10 text-sm">
          <thead className="bg-white/5">
            <tr>
              <th className="table-header">#</th>
              <th className="table-header">Checklist item</th>
              <th className="table-header">Status</th>
              <th className="table-header">Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10 bg-slate-950/40">
            {items.map((it, i) => (
              <tr key={it.id}>
                <td className="table-cell text-slate-500">{i + 1}</td>
                <td className="table-cell">{it.label}</td>
                <td className="table-cell"><StatusBadge status={it.status} /></td>
                <td className="table-cell text-xs text-slate-400">{it.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <Link href="/finance" className="btn-outline text-xs">← back to finance hub</Link>
    </AppLayout>
  );
}
