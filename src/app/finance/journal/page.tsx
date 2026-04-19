import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function JournalPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const tenant = await requireTenant();
  const sp = await searchParams;
  const where: Record<string, unknown> = { tenantId: tenant.id };
  if (sp.status) where.reconciliationStatus = sp.status;
  const [entries, projects, counts] = await Promise.all([
    prisma.journalEntryRow.findMany({ where, include: { project: true }, orderBy: { entryDate: "desc" }, take: 300 }),
    prisma.project.findMany({ where: { tenantId: tenant.id }, select: { id: true, code: true, name: true } }),
    prisma.journalEntryRow.groupBy({ by: ["reconciliationStatus"], where: { tenantId: tenant.id }, _count: { _all: true } }),
  ]);
  const statusMap = Object.fromEntries(counts.map((c) => [c.reconciliationStatus, c._count._all]));

  return (
    <AppLayout eyebrow="CFO · Journal" title="Journal entries" description="Every synced Xero journal row with project + cost-code allocation. Confirm AI suggestions or reassign.">
      <div className="grid gap-6">
        <section className="grid gap-4 md:grid-cols-5">
          <StatTile label="Unreviewed" value={statusMap.UNREVIEWED ?? 0} href="/finance/journal?status=UNREVIEWED" tone={(statusMap.UNREVIEWED ?? 0) > 0 ? "warn" : "good"} />
          <StatTile label="AI suggested" value={statusMap.SUGGESTED ?? 0} href="/finance/journal?status=SUGGESTED" tone="warn" />
          <StatTile label="Confirmed" value={statusMap.CONFIRMED ?? 0} href="/finance/journal?status=CONFIRMED" tone="good" />
          <StatTile label="Needs input" value={statusMap.NEEDS_INPUT ?? 0} href="/finance/journal?status=NEEDS_INPUT" tone="bad" />
          <StatTile label="Rejected" value={statusMap.REJECTED ?? 0} href="/finance/journal?status=REJECTED" />
        </section>
        <section className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-sm">
              <thead className="bg-white/5">
                <tr>
                  <th className="table-header">Date</th>
                  <th className="table-header">Account</th>
                  <th className="table-header">Memo</th>
                  <th className="table-header">Vendor</th>
                  <th className="table-header">Amount</th>
                  <th className="table-header">Project</th>
                  <th className="table-header">Cost code</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Confidence</th>
                  <th className="table-header" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-slate-950/40">
                {entries.map((e) => (
                  <tr key={e.id} className="align-top transition hover:bg-white/5">
                    <td className="table-cell text-slate-400">{formatDate(e.entryDate)}</td>
                    <td className="table-cell"><div>{e.accountName}</div><div className="font-mono text-[10px] text-slate-500">{e.accountCode}</div></td>
                    <td className="table-cell max-w-[260px]">{e.memo}</td>
                    <td className="table-cell text-slate-400">{e.vendorName ?? "—"}</td>
                    <td className={"table-cell font-medium " + (e.amount < 0 ? "text-rose-200" : "text-emerald-200")}>{formatCurrency(e.amount)}</td>
                    <td className="table-cell">{e.project ? <Link href={`/projects/${e.project.id}/financials`} className="text-cyan-300 hover:underline">{e.project.code}</Link> : <span className="text-slate-500">—</span>}</td>
                    <td className="table-cell font-mono text-xs text-slate-400">{e.costCode ?? "—"}</td>
                    <td className="table-cell"><StatusBadge status={e.reconciliationStatus} /></td>
                    <td className="table-cell text-slate-400">{e.allocationConfidence !== null ? `${e.allocationConfidence}%` : "—"}</td>
                    <td className="table-cell">
                      <form action={`/api/journal/${e.id}/assign`} method="post" className="flex flex-wrap gap-1">
                        <select name="projectId" defaultValue={e.projectId ?? ""} className="rounded-md border border-white/10 bg-slate-900 px-2 py-1 text-xs text-white">
                          <option value="">— unassigned —</option>
                          {projects.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}
                        </select>
                        <input name="costCode" defaultValue={e.costCode ?? ""} placeholder="code" className="w-20 rounded-md border border-white/10 bg-slate-900 px-2 py-1 text-xs text-white" />
                        <button name="status" value="CONFIRMED" className="btn-primary text-[10px] px-2 py-1">Confirm</button>
                        <button name="status" value="NEEDS_INPUT" className="btn-outline text-[10px] px-2 py-1">Flag</button>
                      </form>
                    </td>
                  </tr>
                ))}
                {entries.length === 0 ? <tr><td colSpan={10} className="table-cell text-center text-slate-500">No journal rows yet. Run a Xero sync.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
