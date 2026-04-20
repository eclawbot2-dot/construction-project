import Link from "next/link";
import { notFound } from "next/navigation";
import { DetailShell } from "@/components/layout/detail-shell";
import { StatTile } from "@/components/ui/stat-tile";
import { winProbability } from "@/lib/client-ai";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";

export default async function WinProbabilityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await requireTenant();
  const opp = await prisma.opportunity.findFirst({ where: { id, tenantId: tenant.id } });
  if (!opp) notFound();
  const result = await winProbability(id, tenant.id);

  return (
    <DetailShell
      eyebrow="AI · Win probability"
      title={opp.name}
      subtitle={`${opp.clientName ?? "client unknown"} · model confidence ${result.confidence}%`}
      crumbs={[{ label: "Opportunities", href: "/opportunities" }, { label: opp.name, href: `/opportunities/${id}` }, { label: "Win model" }]}
    >
      <section className="grid gap-4 md:grid-cols-3">
        <StatTile label="Win probability" value={`${result.probability}%`} tone={result.probability > 50 ? "good" : "warn"} />
        <StatTile label="Confidence" value={`${result.confidence}%`} />
        <StatTile label="BD probability" value={`${opp.probability}%`} />
      </section>
      <section className="card p-6">
        <div className="text-xs uppercase tracking-[0.2em] text-emerald-300">Drivers</div>
        <ul className="mt-3 space-y-1 text-sm text-slate-200 list-disc pl-5">
          {result.drivers.length > 0 ? result.drivers.map((d, i) => <li key={i}>{d}</li>) : <li className="text-slate-500 list-none">No clear drivers identified.</li>}
        </ul>
      </section>
      <section className="card p-6">
        <div className="text-xs uppercase tracking-[0.2em] text-rose-300">Risks</div>
        <ul className="mt-3 space-y-1 text-sm text-slate-200 list-disc pl-5">
          {result.risks.length > 0 ? result.risks.map((r, i) => <li key={i}>{r}</li>) : <li className="text-slate-500 list-none">No material risks flagged.</li>}
        </ul>
      </section>
      <Link href={`/opportunities/${id}`} className="btn-outline text-xs">← back to opportunity</Link>
    </DetailShell>
  );
}
