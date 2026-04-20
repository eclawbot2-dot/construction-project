import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusBadge } from "@/components/ui/status-badge";
import { clientLtvPredict } from "@/lib/client-ai";
import { requireTenant } from "@/lib/tenant";
import { formatCurrency } from "@/lib/utils";

export default async function ClvPage() {
  const tenant = await requireTenant();
  const clients = await clientLtvPredict(tenant.id);
  const chase = clients.filter((c) => c.strategy === "CHASE").length;
  const projected = clients.reduce((s, c) => s + c.projected5Y, 0);

  return (
    <AppLayout eyebrow="AI · CRM" title="Client lifetime value" description="Five-year projected revenue per client with suggested BD strategy.">
      <section className="grid gap-4 md:grid-cols-4">
        <StatTile label="Clients" value={clients.length} />
        <StatTile label="5y projected" value={formatCurrency(projected)} tone="good" />
        <StatTile label="CHASE" value={chase} tone="good" />
        <StatTile label="DROP" value={clients.filter((c) => c.strategy === "DROP").length} tone="warn" />
      </section>
      <section className="card p-0 overflow-hidden">
        <table className="min-w-full divide-y divide-white/10 text-sm">
          <thead className="bg-white/5">
            <tr>
              <th className="table-header">Client</th>
              <th className="table-header">Past value</th>
              <th className="table-header">5y projected</th>
              <th className="table-header">Retention</th>
              <th className="table-header">Strategy</th>
              <th className="table-header">Why</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10 bg-slate-950/40">
            {clients.map((c) => (
              <tr key={c.clientName}>
                <td className="table-cell font-medium text-white">{c.clientName}</td>
                <td className="table-cell">{formatCurrency(c.past5Y)}</td>
                <td className="table-cell font-semibold text-white">{formatCurrency(c.projected5Y)}</td>
                <td className="table-cell">{c.retention}%</td>
                <td className="table-cell"><StatusBadge status={c.strategy} /></td>
                <td className="table-cell text-xs text-slate-400">{c.rationale}</td>
              </tr>
            ))}
            {clients.length === 0 ? <tr><td colSpan={6} className="table-cell text-center text-slate-500">No clients on file yet.</td></tr> : null}
          </tbody>
        </table>
      </section>
    </AppLayout>
  );
}
