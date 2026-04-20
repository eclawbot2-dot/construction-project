import { notFound } from "next/navigation";
import Link from "next/link";
import { DetailShell } from "@/components/layout/detail-shell";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { scoreRfpListing } from "@/lib/sales-ai";

export default async function ListingScorePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await requireTenant();
  const listing = await prisma.rfpListing.findFirst({ where: { id, tenantId: tenant.id } });
  if (!listing) notFound();
  const score = await scoreRfpListing(tenant.id, id);
  const tone = score.recommendation === "BID" ? "good" : score.recommendation === "CONDITIONAL" ? "warn" : "bad";

  return (
    <DetailShell
      eyebrow="AI · Go/No-go scorer"
      title={listing.title}
      subtitle={`${listing.agency} · scored in ${score.confidence}% confidence window`}
      crumbs={[{ label: "RFPs", href: "/bids/listings" }, { label: "Score" }]}
      actions={<StatusBadge status={score.recommendation} />}
    >
      <section className="grid gap-4 md:grid-cols-3">
        <StatTile label="Recommendation" value={score.recommendation} tone={tone} />
        <StatTile label="Win probability" value={`${score.winProbability}%`} tone={score.winProbability > 50 ? "good" : "warn"} />
        <StatTile label="Confidence" value={`${score.confidence}%`} />
      </section>
      <section className="card p-6">
        <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Why bid</div>
        <ul className="mt-3 space-y-1 text-sm text-slate-200 list-disc pl-5">
          {score.rationale.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      </section>
      <section className="card p-6">
        <div className="text-xs uppercase tracking-[0.2em] text-rose-300">Risks</div>
        <ul className="mt-3 space-y-1 text-sm text-slate-200 list-disc pl-5">
          {score.risks.length > 0 ? score.risks.map((r, i) => <li key={i}>{r}</li>) : <li className="text-slate-500">No material risks flagged.</li>}
        </ul>
      </section>
      <div className="flex gap-2">
        <Link href="/bids/listings" className="btn-outline text-xs">← back to listings</Link>
        {score.recommendation !== "NO_BID" ? (
          <form action={`/api/rfp/listings/${id}/autopilot`} method="post">
            <button className="btn-primary text-xs">Autopilot this RFP</button>
          </form>
        ) : null}
      </div>
    </DetailShell>
  );
}
