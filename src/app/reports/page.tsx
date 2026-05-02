import { AppLayout } from "@/components/layout/app-layout";
import {
  wipReport,
  costToCompleteForecast,
  winRateAnalytics,
  bondingCapacityReport,
} from "@/lib/reports";
import { requireTenant } from "@/lib/tenant";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { addMoney } from "@/lib/money";

/**
 * Reports hub — surety-grade WIP, cost-to-complete, win rate, bonding
 * capacity, plus links to CSV exports for the rest. Tenant-scoped.
 */
export default async function ReportsPage() {
  const tenant = await requireTenant();
  const [wip, ctc, win, bonding] = await Promise.all([
    wipReport(tenant.id),
    costToCompleteForecast(tenant.id),
    winRateAnalytics(tenant.id),
    bondingCapacityReport(tenant.id),
  ]);

  // Aggregate CTC by cost code for a one-glance view.
  const ctcByCode = new Map<string, { budgeted: number; spent: number; committed: number; eac: number }>();
  for (const row of ctc) {
    const slot = ctcByCode.get(row.costCode) ?? { budgeted: 0, spent: 0, committed: 0, eac: 0 };
    slot.budgeted = addMoney(slot.budgeted, row.budgeted);
    slot.spent = addMoney(slot.spent, row.spent);
    slot.committed = addMoney(slot.committed, row.committed);
    slot.eac = addMoney(slot.eac, row.estimateAtCompletion);
    ctcByCode.set(row.costCode, slot);
  }
  const ctcSorted = Array.from(ctcByCode.entries()).sort((a, b) => b[1].eac - a[1].eac).slice(0, 15);

  return (
    <AppLayout eyebrow="Insights" title="Reports" description="Surety-grade WIP, cost-to-complete, bonding posture, and pipeline health. Export any report as CSV.">
      <div className="grid gap-6">
        <section className="grid gap-4 md:grid-cols-4">
          <Tile label="Backlog" value={formatCurrency(bonding.backlog)} sub="Contract − Billed" />
          <Tile label="Work in progress" value={formatCurrency(bonding.workInProgress)} sub="Costs − Billed" />
          <Tile label="Total contract value" value={formatCurrency(bonding.totalContractValue)} />
          <Tile label="Costs to date" value={formatCurrency(bonding.totalCostsToDate)} />
        </section>

        <section className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Surety-grade WIP</div>
              <p className="mt-1 text-xs text-slate-400">Per-project earned revenue + over/under-billed for surety filings.</p>
            </div>
            <a href="/api/reports/wip?format=csv" className="btn-outline text-xs">Export CSV</a>
          </div>
          <table className="mt-4 min-w-full divide-y divide-white/10 text-sm">
            <thead className="text-xs uppercase tracking-[0.16em] text-slate-500">
              <tr>
                <th className="py-2 pr-4 text-left">Project</th>
                <th className="py-2 pr-4 text-right">Contract</th>
                <th className="py-2 pr-4 text-right">% Complete</th>
                <th className="py-2 pr-4 text-right">Earned</th>
                <th className="py-2 pr-4 text-right">Billed</th>
                <th className="py-2 pr-4 text-right">Over</th>
                <th className="py-2 pr-4 text-right">Under</th>
                <th className="py-2 pr-4 text-right">Forecast GM</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {wip.map((r) => (
                <tr key={r.projectId} className="hover:bg-white/5">
                  <td className="py-2 pr-4 text-white">{r.projectName}</td>
                  <td className="py-2 pr-4 text-right text-slate-300">{formatCurrency(r.contractValue)}</td>
                  <td className="py-2 pr-4 text-right text-slate-300">{formatPercent(r.percentComplete * 100)}</td>
                  <td className="py-2 pr-4 text-right text-slate-300">{formatCurrency(r.earnedRevenue)}</td>
                  <td className="py-2 pr-4 text-right text-slate-300">{formatCurrency(r.billedToDate)}</td>
                  <td className="py-2 pr-4 text-right text-amber-300">{r.overBilled > 0 ? formatCurrency(r.overBilled) : "—"}</td>
                  <td className="py-2 pr-4 text-right text-rose-300">{r.underBilled > 0 ? formatCurrency(r.underBilled) : "—"}</td>
                  <td className="py-2 pr-4 text-right text-emerald-300">{formatCurrency(r.forecastGrossMargin)}</td>
                </tr>
              ))}
              {wip.length === 0 ? <tr><td colSpan={8} className="py-3 text-center text-slate-500">No project P&L snapshots yet.</td></tr> : null}
            </tbody>
          </table>
        </section>

        <section className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Cost-to-complete (top 15 codes)</div>
              <p className="mt-1 text-xs text-slate-400">Across all projects, by cost code.</p>
            </div>
            <a href="/api/reports/cost-to-complete?format=csv" className="btn-outline text-xs">Export CSV</a>
          </div>
          <table className="mt-4 min-w-full divide-y divide-white/10 text-sm">
            <thead className="text-xs uppercase tracking-[0.16em] text-slate-500">
              <tr>
                <th className="py-2 pr-4 text-left">Cost code</th>
                <th className="py-2 pr-4 text-right">Budgeted</th>
                <th className="py-2 pr-4 text-right">Spent</th>
                <th className="py-2 pr-4 text-right">Committed</th>
                <th className="py-2 pr-4 text-right">EAC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {ctcSorted.map(([code, s]) => (
                <tr key={code}>
                  <td className="py-2 pr-4 font-mono text-xs text-cyan-200">{code}</td>
                  <td className="py-2 pr-4 text-right">{formatCurrency(s.budgeted)}</td>
                  <td className="py-2 pr-4 text-right">{formatCurrency(s.spent)}</td>
                  <td className="py-2 pr-4 text-right">{formatCurrency(s.committed)}</td>
                  <td className="py-2 pr-4 text-right text-white">{formatCurrency(s.eac)}</td>
                </tr>
              ))}
              {ctcSorted.length === 0 ? <tr><td colSpan={5} className="py-3 text-center text-slate-500">No budget lines yet.</td></tr> : null}
            </tbody>
          </table>
        </section>

        <section className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Win rate by owner</div>
              <p className="mt-1 text-xs text-slate-400">Bid win rate by PM / estimator over the trailing pipeline.</p>
            </div>
            <a href="/api/reports/win-rate?format=csv" className="btn-outline text-xs">Export CSV</a>
          </div>
          <table className="mt-4 min-w-full divide-y divide-white/10 text-sm">
            <thead className="text-xs uppercase tracking-[0.16em] text-slate-500">
              <tr>
                <th className="py-2 pr-4 text-left">Owner</th>
                <th className="py-2 pr-4 text-right">Total bids</th>
                <th className="py-2 pr-4 text-right">Won</th>
                <th className="py-2 pr-4 text-right">Lost</th>
                <th className="py-2 pr-4 text-right">Win rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {win.byOwner.map((r) => (
                <tr key={r.scope}>
                  <td className="py-2 pr-4">{r.scope}</td>
                  <td className="py-2 pr-4 text-right">{r.total}</td>
                  <td className="py-2 pr-4 text-right text-emerald-300">{r.won}</td>
                  <td className="py-2 pr-4 text-right text-rose-300">{r.lost}</td>
                  <td className="py-2 pr-4 text-right">{formatPercent(r.winRate * 100)}</td>
                </tr>
              ))}
              {win.byOwner.length === 0 ? <tr><td colSpan={5} className="py-3 text-center text-slate-500">No opportunities yet.</td></tr> : null}
            </tbody>
          </table>
        </section>

        <section className="card p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">More reports</div>
          <div className="mt-3 grid gap-2 md:grid-cols-2 text-xs">
            <a href="/api/reports/margin-fade?format=csv" className="panel p-3 hover:border-cyan-500/40">Margin-fade trend (CSV)</a>
            <a href="/api/reports/estimate-accuracy?format=csv" className="panel p-3 hover:border-cyan-500/40">Estimate-accuracy (CSV)</a>
            <a href="/api/reports/resource-heatmap?format=csv" className="panel p-3 hover:border-cyan-500/40">Resource heatmap, 8 weeks (CSV)</a>
            <a href="/api/reports/bonding-capacity?format=csv" className="panel p-3 hover:border-cyan-500/40">Bonding capacity (CSV)</a>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-5">
      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
      {sub ? <div className="mt-1 text-xs text-slate-500">{sub}</div> : null}
    </div>
  );
}
