import { notFound } from "next/navigation";
import Link from "next/link";
import { DetailShell } from "@/components/layout/detail-shell";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";

/**
 * Full detail view for a single RFP listing — what the user sees when
 * they click the title in /bids/listings. Shows the score breakdown
 * (signals individually + overall), source provenance, agency tier,
 * autopilot status, opportunity link if drafted, and action buttons
 * for the next move (score / draft / autopilot / open in portal).
 */
export default async function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await requireTenant();
  const listing = await prisma.rfpListing.findFirst({
    where: { id, tenantId: tenant.id },
    include: {
      source: { include: { catalog: true } },
      bidDrafts: { orderBy: { createdAt: "desc" }, take: 5 },
      opportunity: true,
    },
  });
  if (!listing) notFound();

  const signals: Array<{ name: string; weight: number; fit: number; note?: string }> = (() => {
    if (!listing.scoreExplanation) return [];
    try { return JSON.parse(listing.scoreExplanation) as never; } catch { return []; }
  })();

  const score = listing.score;
  const scoreTone: "good" | "warn" | "bad" | "default" =
    score == null ? "default" : score >= 70 ? "good" : score >= 50 ? "warn" : "bad";

  return (
    <DetailShell
      eyebrow={`${listing.agency} · ${listing.solicitationNo ?? "no number"}`}
      title={listing.title}
      subtitle={listing.placeOfPerformance ? `Place of performance — ${listing.placeOfPerformance}` : undefined}
      crumbs={[{ label: "RFPs", href: "/bids/listings" }, { label: listing.title.slice(0, 40) }]}
      actions={<StatusBadge status={listing.status} />}
    >
      <section className="grid gap-4 md:grid-cols-4">
        <StatTile label="Score" value={score == null ? "—" : `${score}/100`} tone={scoreTone} sub={listing.autoDrafted ? "auto-drafted" : undefined} />
        <StatTile label="Estimated value" value={formatCurrency(listing.estimatedValue)} />
        <StatTile label="Due" value={formatDate(listing.dueAt) ?? "—"} tone={listing.dueAt && new Date(listing.dueAt).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000 ? "warn" : "default"} />
        <StatTile label="Posted" value={formatDate(listing.postedAt) ?? "—"} />
      </section>

      <section className="card p-6 mt-6">
        <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Solicitation</div>
        <div className="mt-3 grid gap-3 md:grid-cols-2 text-sm">
          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Agency</div>
            <div className="mt-1 text-slate-200">{listing.agency}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Tier / kind</div>
            <div className="mt-1 text-slate-200">{listing.agencyKind ?? "?"} · {listing.agencyTier ?? "?"}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">NAICS</div>
            <div className="mt-1 font-mono text-slate-200">{listing.naicsCode ?? "—"}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Set-aside</div>
            <div className="mt-1 text-slate-200">{listing.setAside ?? "open"}</div>
          </div>
        </div>
        {listing.url ? (
          <div className="mt-4">
            <a href={listing.url} target="_blank" rel="noopener" className="btn-outline text-xs">
              Open in portal ↗
            </a>
          </div>
        ) : null}
        {listing.summary ? (
          <div className="mt-4 rounded bg-white/[0.02] p-4 text-sm text-slate-300 whitespace-pre-wrap">{listing.summary}</div>
        ) : null}
      </section>

      {signals.length > 0 ? (
        <section className="card p-6 mt-6">
          <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Score breakdown</div>
          <p className="mt-1 text-xs text-slate-400">How this listing was scored against your bid profile. Each signal is weighted; the overall score is the weighted sum × 100.</p>
          <div className="mt-4 space-y-2">
            {signals.map((s, i) => (
              <div key={i} className="grid gap-2 md:grid-cols-[120px_80px_1fr_2fr] items-center text-sm">
                <div className="text-slate-200">{s.name}</div>
                <div className="text-xs text-slate-500">w={Math.round(s.weight * 100)}%</div>
                <div className="h-2 rounded bg-slate-800 overflow-hidden">
                  <div className={`h-full ${s.fit >= 0.7 ? "bg-emerald-500" : s.fit >= 0.4 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${Math.round(s.fit * 100)}%` }} />
                </div>
                <div className="text-xs text-slate-400">{s.note ?? ""}</div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="card p-6 mt-6">
        <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Source</div>
        {listing.source ? (
          <div className="mt-3 grid gap-3 md:grid-cols-2 text-sm">
            <div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Watched as</div>
              <Link href={`/bids/sources`} className="mt-1 block text-cyan-300 hover:underline">{listing.source.label}</Link>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Scraper</div>
              <div className="mt-1 text-slate-200">
                {listing.source.catalog?.scraperKind === "MANUAL" || !listing.source.catalog
                  ? "manual"
                  : `auto · ${listing.source.catalog.scraperKind.toLowerCase()} (${listing.source.catalog.scraperModule ?? "?"})`}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Discovered</div>
              <div className="mt-1 text-slate-200">{formatDateTime(listing.discoveredAt)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Last sweep</div>
              <div className="mt-1 text-slate-200">{listing.source.lastCheckedAt ? formatDateTime(listing.source.lastCheckedAt) : "—"}</div>
            </div>
          </div>
        ) : (
          <div className="mt-3 text-sm text-slate-400">No source on file — this listing was added manually or from a deleted source.</div>
        )}
      </section>

      <section className="card p-6 mt-6">
        <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Triage status</div>
        <p className="mt-1 text-xs text-slate-400">Mark this listing as you work it. Status changes are recorded in the tenant audit log.</p>
        <form action={`/api/rfp/listings/${listing.id}/status`} method="post" className="mt-3 flex flex-wrap items-center gap-2">
          <select name="status" defaultValue={listing.status} className="form-select text-xs">
            {["NEW", "TRIAGED", "QUALIFIED", "PURSUING", "SUBMITTED", "WON", "LOST", "DECLINED"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button type="submit" className="btn-outline text-xs">Update status</button>
        </form>
      </section>

      <section className="card p-6 mt-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Bid drafts</div>
            <p className="mt-1 text-xs text-slate-400">{listing.bidDrafts.length} draft{listing.bidDrafts.length === 1 ? "" : "s"} on file</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/bids/listings/${listing.id}/score`} className="btn-outline text-xs">AI go/no-go</Link>
            <form action={`/api/rfp/listings/${listing.id}/draft`} method="post">
              <button className="btn-outline text-xs">New draft</button>
            </form>
            <form action={`/api/rfp/listings/${listing.id}/autopilot`} method="post">
              <button className="btn-primary text-xs">AI autopilot</button>
            </form>
          </div>
        </div>
        {listing.bidDrafts.length > 0 ? (
          <ul className="mt-3 divide-y divide-white/5">
            {listing.bidDrafts.map((d) => (
              <li key={d.id} className="py-2 flex items-center justify-between text-sm">
                <span className="text-slate-300">{d.title ?? "(untitled draft)"}</span>
                <span className="text-xs text-slate-500">{formatDateTime(d.createdAt)}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {listing.opportunity ? (
          <div className="mt-3 text-xs text-emerald-300">
            ↗ converted to opportunity <Link href={`/opportunities/${listing.opportunity.id}`} className="underline">{listing.opportunity.name ?? listing.opportunity.id}</Link>
          </div>
        ) : null}
      </section>
    </DetailShell>
  );
}
