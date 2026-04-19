import Link from "next/link";
import { notFound } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { ProjectTabs } from "@/components/layout/project-tabs";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function ProjectFinancialsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const tenant = await requireTenant();
  const project = await prisma.project.findFirst({
    where: { id: projectId, tenantId: tenant.id },
    include: {
      pnlSnapshot: true,
      journalEntries: { orderBy: { entryDate: "desc" }, take: 200 },
    },
  });
  if (!project) notFound();

  const pnl = project.pnlSnapshot;
  const journal = project.journalEntries;
  const costByCode = journal
    .filter((j) => j.entryType === "COST_OF_GOODS")
    .reduce<Record<string, number>>((acc, j) => { const k = j.costCode ?? "unassigned"; acc[k] = (acc[k] ?? 0) + Math.abs(j.amount); return acc; }, {});
  const revenueRows = journal.filter((j) => j.entryType === "REVENUE");
  const totalRev = revenueRows.reduce((s, j) => s + j.amount, 0);
  const costRows = journal.filter((j) => j.entryType === "COST_OF_GOODS");
  const totalCost = Math.abs(costRows.reduce((s, j) => s + j.amount, 0));
  const margin = totalRev > 0 ? ((totalRev - totalCost) / totalRev) * 100 : 0;
  const unreconciled = journal.filter((j) => j.reconciliationStatus === "UNREVIEWED" || j.reconciliationStatus === "NEEDS_INPUT").length;

  return (
    <AppLayout eyebrow={`${project.code} · P&L`} title={project.name} description="Project-level financials — contract value, billed vs earned, cost-to-date, forecast margin, WIP over/under billing.">
      <div className="grid gap-6">
        <ProjectTabs projectId={project.id} active="financials" mode={project.mode} />
        {pnl ? (
          <>
            <section className="grid gap-4 md:grid-cols-4">
              <StatTile label="Contract value" value={formatCurrency(pnl.totalContractValue)} sub={`orig ${formatCurrency(pnl.contractValue)} · COs ${formatCurrency(pnl.approvedCOValue)}`} />
              <StatTile label="Billed" value={formatCurrency(pnl.billedToDate)} tone="good" sub={`${pnl.percentComplete.toFixed(1)}% complete`} />
              <StatTile label="Cost to date" value={formatCurrency(pnl.costsToDate)} tone="warn" sub={`committed ${formatCurrency(pnl.committedCost)}`} />
              <StatTile label="Forecast margin" value={formatCurrency(pnl.forecastGrossMargin)} tone={pnl.forecastGrossMargin > 0 ? "good" : "bad"} />
            </section>
            <section className="grid gap-4 md:grid-cols-3">
              <StatTile label="Over/under billing (WIP)" value={formatCurrency(pnl.wipOverUnder)} tone={pnl.wipOverUnder > 0 ? "good" : pnl.wipOverUnder < 0 ? "warn" : "default"} />
              <StatTile label="Forecast final cost" value={formatCurrency(pnl.forecastFinalCost)} />
              <StatTile label="Last reconciled" value={formatDate(pnl.lastReconciledAt)} />
            </section>
          </>
        ) : (
          <div className="card p-5 text-sm text-slate-400">No P&L snapshot yet. Visit <Link href="/finance" className="text-cyan-300 hover:underline">/finance</Link> and sync Xero to populate.</div>
        )}

        <section className="card p-5">
          <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Cost by cost code</div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {Object.entries(costByCode).map(([code, amt]) => (
              <div key={code} className="panel p-3">
                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{code}</div>
                <div className="mt-1 text-xl font-semibold text-white">{formatCurrency(amt)}</div>
              </div>
            ))}
            {Object.keys(costByCode).length === 0 ? <div className="text-sm text-slate-500">No cost allocations yet.</div> : null}
          </div>
        </section>

        <section className="card p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 text-xs uppercase tracking-[0.2em] text-slate-400">
            <div>Journal entries allocated to this project</div>
            <div className="flex gap-2 text-[10px] normal-case tracking-normal text-slate-500">
              <span>Revenue: {formatCurrency(totalRev)}</span>
              <span>· Cost: {formatCurrency(totalCost)}</span>
              <span>· Margin: {margin.toFixed(1)}%</span>
              <span>· Unreconciled: {unreconciled}</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-sm">
              <thead className="bg-white/5">
                <tr>
                  <th className="table-header">Date</th>
                  <th className="table-header">Account</th>
                  <th className="table-header">Memo</th>
                  <th className="table-header">Vendor</th>
                  <th className="table-header">Cost code</th>
                  <th className="table-header">Amount</th>
                  <th className="table-header">Conf.</th>
                  <th className="table-header">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-slate-950/40">
                {journal.map((j) => (
                  <tr key={j.id}>
                    <td className="table-cell text-slate-400">{formatDate(j.entryDate)}</td>
                    <td className="table-cell">{j.accountName}<div className="font-mono text-[10px] text-slate-500">{j.accountCode}</div></td>
                    <td className="table-cell max-w-[280px]">{j.memo}</td>
                    <td className="table-cell text-slate-400">{j.vendorName ?? "—"}</td>
                    <td className="table-cell font-mono text-xs text-slate-400">{j.costCode ?? "—"}</td>
                    <td className={"table-cell font-medium " + (j.amount < 0 ? "text-rose-200" : "text-emerald-200")}>{formatCurrency(j.amount)}</td>
                    <td className="table-cell text-slate-400">{j.allocationConfidence !== null ? `${j.allocationConfidence}%` : "—"}</td>
                    <td className="table-cell"><StatusBadge status={j.reconciliationStatus} /></td>
                  </tr>
                ))}
                {journal.length === 0 ? <tr><td colSpan={8} className="table-cell text-center text-slate-500">No journal entries allocated to this project yet.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
