import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusBadge } from "@/components/ui/status-badge";
import { turnoverPredictor } from "@/lib/ops-ai";
import { requireTenant } from "@/lib/tenant";

export default async function TurnoverPage() {
  const tenant = await requireTenant();
  const risks = await turnoverPredictor(tenant.id);
  const high = risks.filter((r) => r.risk === "HIGH").length;

  return (
    <AppLayout eyebrow="Ops AI" title="Turnover / retention risk" description="AI flags staff at risk of leaving so you can act before exit interviews.">
      <section className="grid gap-4 md:grid-cols-3">
        <StatTile label="At-risk total" value={risks.length} tone={risks.length > 0 ? "warn" : "good"} />
        <StatTile label="High risk" value={high} tone={high > 0 ? "bad" : "good"} />
      </section>
      {risks.map((r, i) => (
        <section key={i} className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{r.role}</div>
              <div className="text-lg font-semibold text-white mt-1">{r.userName}</div>
            </div>
            <StatusBadge status={r.risk} />
          </div>
          <div className="mt-3">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Signals</div>
            <ul className="mt-1 text-sm text-slate-200 list-disc pl-5">{r.signals.map((s, j) => <li key={j}>{s}</li>)}</ul>
          </div>
          <div className="mt-3">
            <div className="text-xs uppercase tracking-[0.18em] text-emerald-300">Retention action</div>
            <p className="mt-1 text-sm text-slate-200 leading-6">{r.retentionAction}</p>
          </div>
        </section>
      ))}
      {risks.length === 0 ? <div className="card p-8 text-center text-slate-500">No at-risk staff flagged.</div> : null}
      <Link href="/operations/ai" className="btn-outline text-xs">← back</Link>
    </AppLayout>
  );
}
