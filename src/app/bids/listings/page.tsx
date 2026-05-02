import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function RfpListingsPage({ searchParams }: { searchParams: Promise<{ status?: string; sourceId?: string; showBlocked?: string }> }) {
  const tenant = await requireTenant();
  const sp = await searchParams;
  const where: Record<string, unknown> = { tenantId: tenant.id };
  if (sp.status) where.status = sp.status;
  if (sp.sourceId) where.sourceId = sp.sourceId;
  // By default hide auto-blocked listings (score capped at ≤25 by a
  // matching blockKeyword on the tenant's bid profile). They're not
  // valuable triage candidates — the operator already said never bid.
  // Operators can reveal them via showBlocked=1, useful for auditing
  // whether the block list is overaggressive.
  const showBlocked = sp.showBlocked === "1";
  if (!showBlocked) {
    where.OR = [{ score: null }, { score: { gt: 25 } }];
  }
  // SQL `score <= 25` excludes NULL automatically — only counts
  // scored-and-capped listings, not unscored ones.
  const blockedCount = await prisma.rfpListing.count({ where: { tenantId: tenant.id, score: { lte: 25 } } });
  const listings = await prisma.rfpListing.findMany({ where, include: { source: true, bidDrafts: true }, orderBy: { discoveredAt: "desc" }, take: 250 });
  const counts = {
    total: await prisma.rfpListing.count({ where: { tenantId: tenant.id } }),
    new: await prisma.rfpListing.count({ where: { tenantId: tenant.id, status: "NEW" } }),
    pursuing: await prisma.rfpListing.count({ where: { tenantId: tenant.id, status: "PURSUING" } }),
    submitted: await prisma.rfpListing.count({ where: { tenantId: tenant.id, status: "SUBMITTED" } }),
  };

  return (
    <AppLayout eyebrow="BD · RFP listings" title="RFPs & solicitations" description="Every solicitation discovered by your watched sources. Filter, draft, or convert to an opportunity.">
      <div className="grid gap-6">
        <section className="grid gap-4 md:grid-cols-4">
          <StatTile label="Total listings" value={counts.total} href="/bids/listings" />
          <StatTile label="New (untriaged)" value={counts.new} tone={counts.new > 0 ? "warn" : "good"} href="/bids/listings?status=NEW" />
          <StatTile label="Pursuing" value={counts.pursuing} href="/bids/listings?status=PURSUING" />
          <StatTile label="Submitted" value={counts.submitted} href="/bids/listings?status=SUBMITTED" />
        </section>
        <section className="card p-0 overflow-hidden">
          <div className="px-5 py-3 text-xs uppercase tracking-[0.2em] text-slate-400 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span>Recent listings</span>
              {blockedCount > 0 ? (
                showBlocked ? (
                  <Link href={preserveQuery(sp, { showBlocked: undefined })} className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] normal-case tracking-normal text-rose-200 hover:bg-rose-500/20">
                    showing {blockedCount} blocked · hide
                  </Link>
                ) : (
                  <Link href={preserveQuery(sp, { showBlocked: "1" })} className="rounded-full bg-slate-500/10 px-2 py-0.5 text-[10px] normal-case tracking-normal text-slate-300 hover:bg-slate-500/20">
                    {blockedCount} hidden by block keywords · show
                  </Link>
                )
              ) : null}
            </div>
            <div className="flex gap-2">
              <Link href="/bids/sources" className="btn-outline text-xs">Manage sources</Link>
              <Link href="/bids/discover" className="btn-primary text-xs">Discover new portals</Link>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-white/5">
                <tr>
                  <th className="table-header">Score</th>
                  <th className="table-header">Agency</th>
                  <th className="table-header">Title</th>
                  <th className="table-header">Value</th>
                  <th className="table-header">NAICS</th>
                  <th className="table-header">Set-aside</th>
                  <th className="table-header">Due</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Drafts</th>
                  <th className="table-header" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-slate-950/40">
                {listings.map((l) => (
                  <tr key={l.id} className="transition hover:bg-white/5">
                    <td className="table-cell text-xs">
                      {l.score == null ? (
                        <span className="text-slate-500">—</span>
                      ) : (
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${l.score >= 70 ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200" : l.score >= 50 ? "border-amber-500/40 bg-amber-500/10 text-amber-200" : "border-slate-500/40 bg-slate-500/10 text-slate-300"}`}
                          title={l.scoreExplanation ?? undefined}
                        >
                          {l.score}{l.autoDrafted ? " · auto" : ""}
                        </span>
                      )}
                    </td>
                    <td className="table-cell text-slate-400">{l.agency}</td>
                    <td className="table-cell">
                      <div className="font-medium text-white">{l.title}</div>
                      {l.solicitationNo ? <div className="font-mono text-xs text-slate-500">{l.solicitationNo}</div> : null}
                    </td>
                    <td className="table-cell">{formatCurrency(l.estimatedValue)}</td>
                    <td className="table-cell font-mono text-xs text-slate-400">{l.naicsCode ?? "—"}</td>
                    <td className="table-cell text-xs text-slate-400">{l.setAside ?? "—"}</td>
                    <td className="table-cell text-slate-400">{formatDate(l.dueAt)}</td>
                    <td className="table-cell"><StatusBadge status={l.status} /></td>
                    <td className="table-cell text-xs text-slate-400">{l.bidDrafts.length}</td>
                    <td className="table-cell">
                      <div className="flex flex-wrap gap-1">
                        <Link href={`/bids/listings/${l.id}/score`} className="btn-outline text-xs" title="Go/no-go AI scorer">Score</Link>
                        <form action={`/api/rfp/listings/${l.id}/draft`} method="post">
                          <button className="btn-outline text-xs">Draft bid</button>
                        </form>
                        <form action={`/api/rfp/listings/${l.id}/autopilot`} method="post">
                          <button className="btn-primary text-xs" title="Draft + estimate + compliance in one click">AI autopilot</button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
                {listings.length === 0 ? <tr><td colSpan={10} className="table-cell text-center text-slate-500">No listings yet. Refresh a source from /bids/sources or discover new portals.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}

// Build a query-string URL that toggles one parameter while preserving
// the rest. Empty/undefined values drop the parameter from the URL so
// /bids/listings stays clean when toggles are off.
function preserveQuery(current: Record<string, string | undefined>, overrides: Record<string, string | undefined>): string {
  const merged = { ...current, ...overrides };
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v) params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `/bids/listings?${qs}` : "/bids/listings";
}
