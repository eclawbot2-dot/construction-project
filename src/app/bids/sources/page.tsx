import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { formatDate } from "@/lib/utils";

export default async function BidSourcesPage() {
  const tenant = await requireTenant();
  const sources = await prisma.rfpSource.findMany({
    where: { tenantId: tenant.id },
    include: {
      listings: { take: 1, orderBy: { discoveredAt: "desc" } },
      // Pull catalog so the table can show whether the source is
      // backed by a real scraper (auto sweep) or is manual-only.
      catalog: { select: { scraperKind: true, scraperModule: true } },
    },
    orderBy: { label: "asc" },
  });
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
        <section className="card p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Scheduled sweep</div>
            <p className="text-sm text-slate-300 mt-1">
              <span className="text-white font-medium">Daily cadence = 6× per business day</span>. Each source re-polls every 4 hours; sweep-now ignores already-fresh sources.
            </p>
            <p className="text-xs text-slate-500 mt-1">External cron can POST to <span className="font-mono">/api/cron/rfp-sweep</span> to trigger programmatically.</p>
          </div>
          <form action="/api/rfp/sweep" method="post">
            <button type="submit" className="btn-primary text-sm">Run sweep now</button>
          </form>
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
                  <th className="table-header">Scraper</th>
                  <th className="table-header">Last checked</th>
                  <th className="table-header">Result</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Auto-draft</th>
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
                    <td className="table-cell">
                      {(() => {
                        const kind = s.catalog?.scraperKind;
                        if (!kind || kind === "MANUAL" || kind === "DEPRECATED") {
                          return <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-300">manual</span>;
                        }
                        return <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-300">auto · {kind.toLowerCase()}</span>;
                      })()}
                    </td>
                    <td className="table-cell text-slate-400">{formatDate(s.lastCheckedAt)}</td>
                    <td className="table-cell text-xs text-slate-400">{s.lastCheckNote ?? "—"}</td>
                    <td className="table-cell"><StatusBadge status={s.status} /></td>
                    <td className="table-cell">
                      <form action={`/api/rfp/sources/${s.id}/auto-draft`} method="post" className="flex items-center gap-1">
                        <label className="flex items-center gap-1 text-xs" style={{ color: "var(--faint)" }}>
                          <input type="checkbox" name="autoDraftEnabled" defaultChecked={s.autoDraftEnabled} />
                          auto-draft
                        </label>
                        <input
                          name="autoDraftMinScore"
                          type="number"
                          min={0}
                          max={100}
                          defaultValue={s.autoDraftMinScore}
                          aria-label="Auto-draft minimum score"
                          className="form-input w-14 text-xs"
                        />
                        <button type="submit" className="btn-outline text-xs">Save</button>
                      </form>
                    </td>
                    <td className="table-cell">
                      <form action={`/api/rfp/sources/${s.id}/refresh`} method="post">
                        <button type="submit" className="btn-outline text-xs">Refresh</button>
                      </form>
                    </td>
                  </tr>
                ))}
                {sources.length === 0 ? <tr><td colSpan={10} className="table-cell text-center text-slate-500">No sources yet. Add one above or via <Link href="/bids/discover" className="underline">Discover</Link>.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
