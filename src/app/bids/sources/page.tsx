import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { formatDate } from "@/lib/utils";

export default async function BidSourcesPage() {
  const tenant = await requireTenant();
  const sources = await prisma.rfpSource.findMany({ where: { tenantId: tenant.id }, include: { listings: { take: 1, orderBy: { discoveredAt: "desc" } } }, orderBy: { label: "asc" } });
  const active = sources.filter((s) => s.status === "ACTIVE").length;
  const totalListings = await prisma.rfpListing.count({ where: { tenantId: tenant.id } });

  return (
    <AppLayout eyebrow="Business development" title="Watched RFP sources" description="URLs that bcon polls for new solicitations. Enable auto-refresh or trigger one manually.">
      <div className="grid gap-6">
        <section className="grid gap-4 md:grid-cols-4">
          <StatTile label="Sources configured" value={sources.length} />
          <StatTile label="Active" value={active} tone="good" />
          <StatTile label="Paused / error" value={sources.length - active} tone={sources.length - active > 0 ? "warn" : "good"} />
          <StatTile label="Listings on file" value={totalListings} href="/bids/listings" />
        </section>
        <section className="card p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Add source</div>
          <form action="/api/rfp/sources/create" method="post" className="mt-4 grid gap-3 md:grid-cols-[2fr_2fr_1fr_auto]">
            <input name="label" placeholder="Label — e.g. SAM.gov saved search" required className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500" />
            <input name="url" placeholder="https://…" required className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500" />
            <input name="naicsFilter" placeholder="NAICS (optional)" className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500" />
            <button type="submit" className="btn-primary">Watch</button>
          </form>
        </section>
        <section className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-white/5">
                <tr>
                  <th className="table-header">Label</th>
                  <th className="table-header">URL</th>
                  <th className="table-header">Cadence</th>
                  <th className="table-header">NAICS</th>
                  <th className="table-header">Last checked</th>
                  <th className="table-header">Result</th>
                  <th className="table-header">Status</th>
                  <th className="table-header" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-slate-950/40">
                {sources.map((s) => (
                  <tr key={s.id} className="transition hover:bg-white/5">
                    <td className="table-cell"><Link href={`/bids/listings?sourceId=${s.id}`} className="font-medium text-white hover:text-cyan-200">{s.label}</Link></td>
                    <td className="table-cell font-mono text-xs text-slate-400 truncate max-w-[280px]"><a href={s.url} target="_blank" rel="noopener" className="text-cyan-300 hover:underline">{s.url}</a></td>
                    <td className="table-cell">{s.cadence}</td>
                    <td className="table-cell text-slate-400">{s.naicsFilter ?? "—"}</td>
                    <td className="table-cell text-slate-400">{formatDate(s.lastCheckedAt)}</td>
                    <td className="table-cell text-xs text-slate-400">{s.lastCheckNote ?? "—"}</td>
                    <td className="table-cell"><StatusBadge status={s.status} /></td>
                    <td className="table-cell">
                      <form action={`/api/rfp/sources/${s.id}/refresh`} method="post">
                        <button type="submit" className="btn-outline text-xs">Refresh</button>
                      </form>
                    </td>
                  </tr>
                ))}
                {sources.length === 0 ? <tr><td colSpan={8} className="table-cell text-center text-slate-500">No sources yet. Add one above or use the seed defaults.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
