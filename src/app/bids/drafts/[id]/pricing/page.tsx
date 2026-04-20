import { notFound } from "next/navigation";
import Link from "next/link";
import { DetailShell } from "@/components/layout/detail-shell";
import { StatTile } from "@/components/ui/stat-tile";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { pricingAdvisor } from "@/lib/sales-ai";

export default async function PricingAdvisorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await requireTenant();
  const draft = await prisma.bidDraft.findFirst({ where: { id, tenantId: tenant.id } });
  if (!draft) notFound();
  const advice = await pricingAdvisor(id);
  const tone = advice.direction === "LOWER" ? "bad" : advice.direction === "RAISE" ? "warn" : "good";

  return (
    <DetailShell
      eyebrow="AI · Pricing advisor"
      title={`Margin guidance — ${draft.title}`}
      subtitle="Model reviews historical win rate at different margin bands to suggest a zone."
      crumbs={[{ label: "Bid Hub", href: "/bids" }, { label: draft.title, href: `/bids/drafts/${id}` }, { label: "Pricing" }]}
      actions={<Link href={`/bids/drafts/${id}`} className="btn-outline text-xs">← back</Link>}
    >
      <section className="grid gap-4 md:grid-cols-4">
        <StatTile label="Current margin" value={`${advice.currentMargin.toFixed(1)}%`} />
        <StatTile label="Suggested" value={`${advice.suggestedMargin.toFixed(1)}%`} tone={tone} />
        <StatTile label="Win rate @ current" value={`${advice.winRateAtCurrent}%`} />
        <StatTile label="Win rate @ suggested" value={`${advice.winRateAtSuggested}%`} tone="good" />
      </section>
      <section className="card p-6">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Recommendation</div>
        <div className="mt-2 text-2xl font-semibold text-white">{advice.direction}</div>
        <p className="mt-3 text-sm leading-6 text-slate-200">{advice.rationale}</p>
        <p className="mt-3 text-xs text-slate-500">Advisor is deterministic today; flip <span className="font-mono">ENABLE_LLM_CALLS=true</span> to route through Claude.</p>
      </section>
    </DetailShell>
  );
}
