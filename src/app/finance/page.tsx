import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function FinanceHubPage() {
  const tenant = await requireTenant();
  const [xero, qbo, inbox, statements, snapshots, unreconciled, flagged] = await Promise.all([
    prisma.xeroConnection.findUnique({ where: { tenantId: tenant.id } }),
    prisma.qboConnection.findUnique({ where: { tenantId: tenant.id } }),
    prisma.invoiceInboxConnection.findUnique({ where: { tenantId: tenant.id } }),
    prisma.financialStatement.findMany({ where: { tenantId: tenant.id, statementType: "INCOME_STATEMENT" }, orderBy: { periodStart: "desc" }, take: 12 }),
    prisma.projectPnlSnapshot.findMany({ where: { project: { tenantId: tenant.id } }, include: { project: true }, orderBy: { updatedAt: "desc" } }),
    prisma.journalEntryRow.count({ where: { tenantId: tenant.id, reconciliationStatus: "UNREVIEWED" } }),
    prisma.journalEntryRow.count({ where: { tenantId: tenant.id, reconciliationStatus: "NEEDS_INPUT" } }),
  ]);

  const ytdRevenue = statements.reduce((s, st) => s + st.revenue, 0);
  const ytdCogs = statements.reduce((s, st) => s + st.cogs, 0);
  const ytdOpex = statements.reduce((s, st) => s + st.opex, 0);
  const ytdEbitda = statements.reduce((s, st) => s + st.ebitda, 0);
  const ytdMargin = ytdRevenue > 0 ? (ytdEbitda / ytdRevenue) * 100 : 0;

  const totalBilled = snapshots.reduce((s, p) => s + p.billedToDate, 0);
  const totalCost = snapshots.reduce((s, p) => s + p.costsToDate, 0);
  const backlog = snapshots.reduce((s, p) => s + (p.totalContractValue - p.billedToDate), 0);
  const overbilled = snapshots.filter((p) => p.wipOverUnder > 0).reduce((s, p) => s + p.wipOverUnder, 0);
  const underbilled = snapshots.filter((p) => p.wipOverUnder < 0).reduce((s, p) => s + Math.abs(p.wipOverUnder), 0);

  return (
    <AppLayout eyebrow="CFO · Finance hub" title="Financial operations" description="Xero-synced income statements, project-level P&amp;L, AI cost reconciliation, and invoice inbox monitoring.">
      <div className="grid gap-6">
        <section className="grid gap-4 md:grid-cols-4">
          <StatTile label="Trailing 12mo revenue" value={formatCurrency(ytdRevenue)} tone="good" />
          <StatTile label="Trailing 12mo EBITDA" value={formatCurrency(ytdEbitda)} sub={`${ytdMargin.toFixed(1)}% margin`} tone={ytdMargin >= 10 ? "good" : "warn"} />
          <StatTile label="Backlog (contract - billed)" value={formatCurrency(backlog)} />
          <StatTile label="Unreconciled journal rows" value={unreconciled + flagged} sub={`${unreconciled} unreviewed · ${flagged} needs input`} tone={unreconciled + flagged > 0 ? "warn" : "good"} href="/finance/journal" />
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <StatTile label="Billed to date (portfolio)" value={formatCurrency(totalBilled)} />
          <StatTile label="Costs to date (portfolio)" value={formatCurrency(totalCost)} />
          <StatTile label="Cash position est." value={formatCurrency(totalBilled - totalCost + snapshots.reduce((s, p) => s + (p.totalContractValue * 0.10), 0))} sub="billed - costs + retainage equiv." tone="good" />
          <StatTile label="Overbilled / underbilled" value={`${formatCurrency(overbilled)} / ${formatCurrency(underbilled)}`} tone="warn" href="/finance/ap-aging" />
        </section>
        <section className="flex flex-wrap gap-3">
          <Link href="/finance/ap-aging" className="btn-outline text-xs">Open AP aging →</Link>
          <Link href="/finance/journal" className="btn-outline text-xs">Journal</Link>
          <Link href="/finance/inbox" className="btn-outline text-xs">Invoice inbox</Link>
          <a href="/api/export/journal" className="btn-outline text-xs">Export journal CSV</a>
          <a href="/api/export/ap-aging" className="btn-outline text-xs">Export AP CSV</a>
        </section>

        <section className="card p-5">
          <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Data quality</div>
          <div className="mt-3 grid gap-3 md:grid-cols-4">
            <div className="panel p-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Xero sync</div>
              <div className="mt-1 text-sm text-white">{xero?.lastSyncedAt ? `Synced ${formatDate(xero.lastSyncedAt)}` : xero?.status === "CONNECTED" ? "Connected, never synced" : "Not connected"}</div>
              {xero?.lastSyncedAt && Date.now() - new Date(xero.lastSyncedAt).getTime() > 7 * 24 * 60 * 60 * 1000 ? <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-amber-300">Stale — run sync</div> : null}
            </div>
            <div className="panel p-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">QBO sync</div>
              <div className="mt-1 text-sm text-white">{qbo?.lastSyncedAt ? `Synced ${formatDate(qbo.lastSyncedAt)}` : qbo?.status === "CONNECTED" ? "Connected, never synced" : "Not connected"}</div>
              {qbo?.lastSyncedAt && Date.now() - new Date(qbo.lastSyncedAt).getTime() > 7 * 24 * 60 * 60 * 1000 ? <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-amber-300">Stale — run sync</div> : null}
            </div>
            <div className="panel p-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Invoice inbox</div>
              <div className="mt-1 text-sm text-white">{inbox?.lastPolledAt ? `Polled ${formatDate(inbox.lastPolledAt)}` : inbox?.status === "CONNECTED" ? "Connected, never polled" : "Not connected"}</div>
            </div>
            <div className="panel p-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Unreconciled journal rows</div>
              <div className="mt-1 text-sm text-white">{unreconciled + flagged} rows awaiting action</div>
              {unreconciled + flagged > 0 ? <Link href="/finance/journal" className="mt-1 text-[10px] uppercase tracking-[0.18em] text-cyan-300">Review now →</Link> : null}
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="card p-5">
            <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Xero</div>
            <div className="mt-1 text-lg font-semibold text-white">{xero?.organizationName ?? "Not connected"}</div>
            <div className="text-xs text-slate-400">Status: <StatusBadge status={xero?.status ?? "DISCONNECTED"} /></div>
            {xero?.lastSyncedAt ? <div className="mt-1 text-xs text-slate-500">Last sync {formatDate(xero.lastSyncedAt)} · {xero.lastSyncNote}</div> : null}
            <div className="mt-4 flex flex-wrap gap-2">
              {xero?.status === "CONNECTED" ? (
                <>
                  <form action="/api/xero/connect" method="post">
                    <input type="hidden" name="action" value="sync" />
                    <button className="btn-primary text-xs">Sync now</button>
                  </form>
                  <form action="/api/xero/connect" method="post">
                    <input type="hidden" name="action" value="disconnect" />
                    <button className="btn-outline text-xs">Disconnect</button>
                  </form>
                </>
              ) : (
                <form action="/api/xero/connect" method="post">
                  <input type="hidden" name="action" value="connect" />
                  <button className="btn-primary text-xs">Connect Xero (demo)</button>
                </form>
              )}
            </div>
          </div>

          <div className="card p-5">
            <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">QuickBooks Online</div>
            <div className="mt-1 text-lg font-semibold text-white">{qbo?.organizationName ?? "Not connected"}</div>
            <div className="text-xs text-slate-400">Status: <StatusBadge status={qbo?.status ?? "DISCONNECTED"} /></div>
            {qbo?.realmId ? <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-slate-500">Realm {qbo.realmId} · {qbo.environment}</div> : null}
            {qbo?.lastSyncedAt ? <div className="mt-1 text-xs text-slate-500">Last sync {formatDate(qbo.lastSyncedAt)} · {qbo.lastSyncNote}</div> : null}
            <div className="mt-4 flex flex-wrap gap-2">
              {qbo?.status === "CONNECTED" ? (
                <>
                  <form action="/api/qbo/connect" method="post">
                    <input type="hidden" name="action" value="sync" />
                    <button className="btn-primary text-xs">Sync now</button>
                  </form>
                  <form action="/api/qbo/connect" method="post">
                    <input type="hidden" name="action" value="disconnect" />
                    <button className="btn-outline text-xs">Disconnect</button>
                  </form>
                </>
              ) : (
                <form action="/api/qbo/connect" method="post">
                  <input type="hidden" name="action" value="connect" />
                  <button className="btn-primary text-xs">Connect QBO (demo)</button>
                </form>
              )}
            </div>
            <div className="mt-3 text-[10px] uppercase tracking-[0.18em] text-slate-500">Pulls JournalEntry + ProfitAndLoss reports · Class / Customer:Job → project</div>
          </div>

          <div className="card p-5">
            <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Invoice inbox</div>
            <div className="mt-1 text-lg font-semibold text-white">{inbox?.mailbox ?? "Not connected"}</div>
            <div className="text-xs text-slate-400">Status: <StatusBadge status={inbox?.status ?? "DISCONNECTED"} /></div>
            {inbox?.lastPolledAt ? <div className="mt-1 text-xs text-slate-500">Last poll {formatDate(inbox.lastPolledAt)} · {inbox.lastPollStatus}</div> : null}
            <div className="mt-4 flex gap-2">
              <Link href="/finance/inbox" className="btn-outline text-xs">Configure inbox →</Link>
              {inbox?.status === "CONNECTED" ? (
                <form action="/api/inbox/connect" method="post">
                  <input type="hidden" name="action" value="poll" />
                  <button className="btn-primary text-xs">Poll now</button>
                </form>
              ) : null}
            </div>
          </div>
        </section>

        <section className="card p-0 overflow-hidden">
          <div className="px-5 py-3 text-xs uppercase tracking-[0.2em] text-slate-400">Income statement — trailing months</div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-white/5">
                <tr>
                  <th className="table-header">Period</th>
                  <th className="table-header">Revenue</th>
                  <th className="table-header">COGS</th>
                  <th className="table-header">Gross profit</th>
                  <th className="table-header">OpEx</th>
                  <th className="table-header">EBITDA</th>
                  <th className="table-header">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-slate-950/40">
                {statements.map((st) => {
                  const margin = st.revenue > 0 ? (st.ebitda / st.revenue) * 100 : 0;
                  return (
                    <tr key={st.id}>
                      <td className="table-cell">{formatDate(st.periodStart)} → {formatDate(st.periodEnd)}</td>
                      <td className="table-cell">{formatCurrency(st.revenue)}</td>
                      <td className="table-cell">{formatCurrency(st.cogs)}</td>
                      <td className="table-cell">{formatCurrency(st.grossProfit)}</td>
                      <td className="table-cell">{formatCurrency(st.opex)}</td>
                      <td className="table-cell">{formatCurrency(st.ebitda)}</td>
                      <td className="table-cell">{margin.toFixed(1)}%</td>
                    </tr>
                  );
                })}
                {statements.length === 0 ? <tr><td colSpan={7} className="table-cell text-center text-slate-500">No statements yet. Connect Xero + Sync.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card p-0 overflow-hidden">
          <div className="px-5 py-3 text-xs uppercase tracking-[0.2em] text-slate-400">Project P&L — portfolio</div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-white/5">
                <tr>
                  <th className="table-header">Project</th>
                  <th className="table-header">Contract value</th>
                  <th className="table-header">+COs</th>
                  <th className="table-header">Billed</th>
                  <th className="table-header">% complete</th>
                  <th className="table-header">Costs</th>
                  <th className="table-header">Forecast margin</th>
                  <th className="table-header">O/U billing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-slate-950/40">
                {snapshots.map((s) => (
                  <tr key={s.id} className="transition hover:bg-white/5">
                    <td className="table-cell"><Link href={`/projects/${s.projectId}/financials`} className="text-cyan-300 hover:underline">{s.project.code} · {s.project.name}</Link></td>
                    <td className="table-cell">{formatCurrency(s.contractValue)}</td>
                    <td className="table-cell">{formatCurrency(s.approvedCOValue)}</td>
                    <td className="table-cell">{formatCurrency(s.billedToDate)}</td>
                    <td className="table-cell">{s.percentComplete.toFixed(1)}%</td>
                    <td className="table-cell">{formatCurrency(s.costsToDate)}</td>
                    <td className="table-cell">
                      <span className={s.forecastGrossMargin > 0 ? "text-emerald-300" : "text-rose-300"}>{formatCurrency(s.forecastGrossMargin)}</span>
                    </td>
                    <td className="table-cell">
                      <span className={s.wipOverUnder === 0 ? "text-slate-400" : s.wipOverUnder > 0 ? "text-emerald-300" : "text-amber-300"}>{formatCurrency(s.wipOverUnder)}</span>
                    </td>
                  </tr>
                ))}
                {snapshots.length === 0 ? <tr><td colSpan={8} className="table-cell text-center text-slate-500">No P&L snapshots yet. Sync Xero.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
