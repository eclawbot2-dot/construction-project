import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { StatTile } from "@/components/ui/stat-tile";
import { coiExpirationScan } from "@/lib/compliance-ai";
import { requireTenant } from "@/lib/tenant";

export default async function RiskHubPage() {
  const tenant = await requireTenant();
  const coi = await coiExpirationScan(tenant.id);
  const critical = coi.filter((c) => c.daysUntilExpiry <= 14).length;

  return (
    <AppLayout eyebrow="Compliance & risk" title="Risk AI hub" description="COI expirations, contract clause extraction, lien waiver validation, change-order drafting, vendor prequal auto-fill.">
      <section className="grid gap-4 md:grid-cols-4">
        <StatTile label="COIs lapsing ≤ 60d" value={coi.length} tone={coi.length > 0 ? "warn" : "good"} />
        <StatTile label="Critical (≤ 14d)" value={critical} tone={critical > 0 ? "bad" : "good"} />
      </section>
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Tile href="/risk/coi" title="COI expiration scanner" body="Nightly review of insurance certs lapsing in next 60 days; auto-draft renewal emails." />
        <Tile href="/risk/contract-clauses" title="Contract clause extractor" body="Pull LD, escalation, warranty, exclusions, insurance requirements from contracts." />
        <Tile href="/risk/lien-waiver" title="Lien waiver validator" body="Confirm party name, amount, through-date match before payment release." />
        <Tile href="/risk/change-order" title="CO justification drafter" body="Formal narrative + cost breakdown + schedule impact for owner acceptance." />
        <Tile href="/risk/prequal" title="Prequal auto-fill" body="Fill standard prequalification questionnaire from vendor profile." />
      </section>
      {coi.length > 0 ? (
        <section className="card p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-amber-300">Expiring certificates</div>
          <ul className="mt-3 space-y-1 text-sm text-slate-200">
            {coi.slice(0, 10).map((c) => (
              <li key={c.vendorId + c.policyType}>
                <Link href={`/vendors/${c.vendorId}`} className="text-cyan-300 hover:underline">{c.vendorName}</Link> — {c.policyType} in {c.daysUntilExpiry} days
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </AppLayout>
  );
}

function Tile({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link href={href} className="card p-6 transition hover:border-cyan-500/50">
      <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">AI</div>
      <div className="mt-2 text-lg font-semibold text-white">{title}</div>
      <p className="mt-2 text-sm text-slate-400">{body}</p>
    </Link>
  );
}
