import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function RfpListingsPage({ searchParams }: { searchParams: Promise<{ status?: string; sourceId?: string }> }) {
  const tenant = await requireTenant();
  const sp = await searchParams;
  const where: Record<string, unknown> = { tenantId: tenant.id };
  if (sp.status) where.status = sp.status;
  if (sp.sourceId) where.sourceId = sp.sourceId;
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
            <div>Recent listings</div>
            <div className="flex gap-2">
              <Link href="/bids/sources" className="btn-outline text-xs">Manage sources</Link>
              <Link href="/bids/discover" className="btn-primary text-xs">Discover new portals</Link>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-white/5">
                <tr>
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
                {listings.length === 0 ? <tr><td colSpan={9} className="table-cell text-center text-slate-500">No listings yet. Refresh a source from /bids/sources or discover new portals.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
