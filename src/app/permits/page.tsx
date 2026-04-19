import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { formatDate } from "@/lib/utils";

export default async function PermitsPortfolioPage() {
  const tenant = await requireTenant();
  const permits = await prisma.permit.findMany({
    where: { project: { tenantId: tenant.id } },
    include: { project: true, inspections: { where: { result: "FAIL" } } },
    orderBy: [{ expiresAt: "asc" }, { issuedAt: "desc" }],
  });

  const now = Date.now();
  const ms60 = 60 * 24 * 3600 * 1000;
  const ms14 = 14 * 24 * 3600 * 1000;
  const expiring60 = permits.filter((p) => p.expiresAt && new Date(p.expiresAt).getTime() - now < ms60 && p.status === "ISSUED");
  const expiring14 = permits.filter((p) => p.expiresAt && new Date(p.expiresAt).getTime() - now < ms14 && p.status === "ISSUED");
  const expired = permits.filter((p) => p.expiresAt && new Date(p.expiresAt).getTime() < now && p.status !== "FINALED");
  const underReview = permits.filter((p) => p.status === "UNDER_REVIEW");
  const openFailures = permits.filter((p) => p.inspections.length > 0);

  return (
    <AppLayout eyebrow="Portfolio · Permits" title="Permit expiry watch" description="Permits across every project, sorted by expiration. Fire an auto-lookup on any permit to sync inspections from the jurisdiction.">
      <div className="grid gap-6">
        <section className="grid gap-4 md:grid-cols-5">
          <StatTile label="Permits total" value={permits.length} />
          <StatTile label="Expiring in 14d" value={expiring14.length} tone={expiring14.length > 0 ? "bad" : "good"} />
          <StatTile label="Expiring in 60d" value={expiring60.length} tone={expiring60.length > 0 ? "warn" : "good"} />
          <StatTile label="Already expired" value={expired.length} tone={expired.length > 0 ? "bad" : "good"} />
          <StatTile label="With failed inspections" value={openFailures.length} tone={openFailures.length > 0 ? "warn" : "good"} />
        </section>
        <section className="card p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 text-xs uppercase tracking-[0.2em] text-slate-400">
            <div>Permit ledger</div>
            <div>{underReview.length} under review</div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-sm">
              <thead className="bg-white/5">
                <tr>
                  <th className="table-header">Project</th>
                  <th className="table-header">Permit #</th>
                  <th className="table-header">Type</th>
                  <th className="table-header">Jurisdiction</th>
                  <th className="table-header">Issued</th>
                  <th className="table-header">Expires</th>
                  <th className="table-header">Days left</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Failed insp.</th>
                  <th className="table-header" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-slate-950/40">
                {permits.map((p) => {
                  const daysLeft = p.expiresAt ? Math.round((new Date(p.expiresAt).getTime() - now) / (1000 * 60 * 60 * 24)) : null;
                  const tone = daysLeft === null ? "text-slate-400" : daysLeft < 0 ? "text-rose-300" : daysLeft < 14 ? "text-amber-300" : daysLeft < 60 ? "text-slate-300" : "text-emerald-300";
                  return (
                    <tr key={p.id} className="transition hover:bg-white/5">
                      <td className="table-cell"><Link href={`/projects/${p.project.id}/permits`} className="text-cyan-300 hover:underline">{p.project.code}</Link></td>
                      <td className="table-cell font-mono text-xs">{p.permitNumber}</td>
                      <td className="table-cell">{p.permitType}</td>
                      <td className="table-cell text-slate-400">{p.jurisdiction}</td>
                      <td className="table-cell text-slate-400">{formatDate(p.issuedAt)}</td>
                      <td className="table-cell text-slate-400">{formatDate(p.expiresAt)}</td>
                      <td className={`table-cell font-semibold ${tone}`}>{daysLeft === null ? "—" : daysLeft < 0 ? `${Math.abs(daysLeft)}d past` : `${daysLeft}d`}</td>
                      <td className="table-cell"><StatusBadge status={p.status} /></td>
                      <td className="table-cell">{p.inspections.length > 0 ? <StatusBadge tone="bad" label={`${p.inspections.length} failed`} /> : <span className="text-slate-500">—</span>}</td>
                      <td className="table-cell">
                        <form action={`/api/permits/${p.id}/lookup`} method="post">
                          <button className="btn-outline text-xs" disabled={!p.autoLookupEnabled}>{p.autoLookupEnabled ? "Sync" : "Off"}</button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
                {permits.length === 0 ? <tr><td colSpan={10} className="table-cell text-center text-slate-500">No permits in the portfolio.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
