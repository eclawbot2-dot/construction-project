import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatTile } from "@/components/ui/stat-tile";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { formatCurrency, formatDate, modeLabel } from "@/lib/utils";

export default async function BidsHubPage() {
  const tenant = await requireTenant();
  const [opportunities, bidPackages] = await Promise.all([
    prisma.opportunity.findMany({ where: { tenantId: tenant.id }, orderBy: [{ stage: "asc" }, { dueDate: "asc" }] }),
    prisma.bidPackage.findMany({ where: { project: { tenantId: tenant.id } }, include: { project: true, subBids: true }, orderBy: { dueDate: "asc" } }),
  ]);

  const pipelineValue = opportunities.filter((o) => o.stage !== "LOST" && o.stage !== "WITHDRAWN").reduce((s, o) => s + o.estimatedValue, 0);
  const weightedValue = opportunities.filter((o) => o.stage !== "LOST" && o.stage !== "WITHDRAWN").reduce((s, o) => s + o.estimatedValue * (o.probability / 100), 0);
  const openPackages = bidPackages.filter((p) => p.status !== "AWARDED" && p.status !== "CANCELLED").length;

  return (
    <AppLayout eyebrow="Business development" title="Bid hub" description="Opportunity pipeline, active bid packages, and trade invitations across every pursuit.">
      <div className="grid gap-6">
        <section className="grid gap-4 md:grid-cols-4">
          <StatTile label="Opportunities" value={opportunities.length} />
          <StatTile label="Pipeline value" value={formatCurrency(pipelineValue)} />
          <StatTile label="Weighted pipeline" value={formatCurrency(weightedValue)} tone="good" />
          <StatTile label="Bid packages open" value={openPackages} tone={openPackages > 0 ? "warn" : "good"} />
        </section>

        <section className="card p-0 overflow-hidden">
          <div className="px-5 py-3 text-xs uppercase tracking-[0.2em] text-slate-400">Opportunity pipeline</div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-white/5">
                <tr>
                  <th className="table-header">Name</th>
                  <th className="table-header">Client</th>
                  <th className="table-header">Mode</th>
                  <th className="table-header">Stage</th>
                  <th className="table-header">Value</th>
                  <th className="table-header">Prob.</th>
                  <th className="table-header">Weighted</th>
                  <th className="table-header">Due</th>
                  <th className="table-header">Owner</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-slate-950/40">
                {opportunities.map((o) => (
                  <tr key={o.id} className="cursor-pointer transition hover:bg-white/5">
                    <td className="table-cell font-medium"><Link href={`/opportunities/${o.id}`} className="text-cyan-300 hover:text-cyan-200 hover:underline">{o.name}</Link></td>
                    <td className="table-cell text-slate-400">{o.clientName ?? "—"}</td>
                    <td className="table-cell">{modeLabel(o.mode)}</td>
                    <td className="table-cell"><StatusBadge status={o.stage} /></td>
                    <td className="table-cell">{formatCurrency(o.estimatedValue)}</td>
                    <td className="table-cell">{o.probability}%</td>
                    <td className="table-cell">{formatCurrency(o.estimatedValue * (o.probability / 100))}</td>
                    <td className="table-cell text-slate-400">{formatDate(o.dueDate)}</td>
                    <td className="table-cell text-slate-400">{o.ownerName ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card p-0 overflow-hidden">
          <div className="px-5 py-3 text-xs uppercase tracking-[0.2em] text-slate-400">Active bid packages</div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-white/5">
                <tr>
                  <th className="table-header">Project</th>
                  <th className="table-header">Package</th>
                  <th className="table-header">Trade</th>
                  <th className="table-header">Est. value</th>
                  <th className="table-header">Invitees</th>
                  <th className="table-header">Due</th>
                  <th className="table-header">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-slate-950/40">
                {bidPackages.map((p) => (
                  <tr key={p.id} className="cursor-pointer transition hover:bg-white/5">
                    <td className="table-cell"><Link href={`/projects/${p.project.id}/bids`} className="text-cyan-300 hover:underline">{p.project.code}</Link></td>
                    <td className="table-cell font-medium text-white">{p.name}</td>
                    <td className="table-cell">{p.trade}</td>
                    <td className="table-cell">{formatCurrency(p.estimatedValue)}</td>
                    <td className="table-cell">{p.subBids.length}</td>
                    <td className="table-cell text-slate-400">{formatDate(p.dueDate)}</td>
                    <td className="table-cell"><StatusBadge status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
