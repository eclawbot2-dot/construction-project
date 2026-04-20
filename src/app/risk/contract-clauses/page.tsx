import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { StatusBadge } from "@/components/ui/status-badge";
import { extractContractClauses } from "@/lib/compliance-ai";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";

export default async function ClauseExtractPage({ searchParams }: { searchParams: Promise<{ contractId?: string; text?: string }> }) {
  const tenant = await requireTenant();
  const sp = await searchParams;
  const contracts = await prisma.contract.findMany({ where: { project: { tenantId: tenant.id } }, include: { project: true }, orderBy: { createdAt: "desc" } });
  const clauses = sp.contractId ? await extractContractClauses(sp.contractId, tenant.id, sp.text) : null;

  return (
    <AppLayout eyebrow="AI · Risk" title="Contract clause extractor" description="Paste the contract body to get a clause-by-clause parse. Without text, returns a best-practice template.">
      <form method="get" className="card p-6 grid gap-3">
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <select name="contractId" defaultValue={sp.contractId ?? ""} className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white">
            <option value="">— select contract —</option>
            {contracts.map((c) => <option key={c.id} value={c.id}>{c.project.code} — {c.contractNumber} — {c.counterparty}</option>)}
          </select>
          <Link href="/risk" className="btn-outline text-xs self-center">← back</Link>
        </div>
        <label className="text-xs uppercase tracking-[0.2em] text-slate-400">Paste contract body (optional — enables deep parse)</label>
        <textarea name="text" defaultValue={sp.text ?? ""} rows={10} placeholder="Paste the full contract body here for regex-based clause extraction…" className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" />
        <button className="btn-primary w-fit">Extract</button>
      </form>
      {clauses ? (
        <>
          <section className="card p-6">
            <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Parse source · {clauses.sourceKind}</div>
            <p className="mt-2 text-xs text-slate-500">{clauses.sourceKind === "PARSED" ? "Extracted from the pasted contract text using 20+ regex patterns." : "Contract text not supplied — showing best-practice template."}</p>
          </section>
          <section className="card p-6">
            <div className="text-xs uppercase tracking-[0.2em] text-rose-300">Liquidated damages</div>
            <div className="mt-2 text-sm text-slate-200">
              {clauses.liquidatedDamages.present ? `Present — ${clauses.liquidatedDamages.amount}. Trigger: ${clauses.liquidatedDamages.trigger}` : "Not present."}
            </div>
          </section>
          <section className="card p-6">
            <div className="text-xs uppercase tracking-[0.2em] text-amber-300">Escalation clause</div>
            <div className="mt-2 text-sm text-slate-200">{clauses.escalation.present ? clauses.escalation.clause : "Not present."}</div>
          </section>
          <section className="card p-6">
            <div className="text-xs uppercase tracking-[0.2em] text-emerald-300">Warranty</div>
            <div className="mt-2 text-sm text-slate-200">{clauses.warranty.durationMonths} months — {clauses.warranty.coverage}</div>
          </section>
          <section className="card p-6">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Exclusions</div>
            <ul className="mt-3 space-y-1 text-sm text-slate-200 list-disc pl-5">{clauses.exclusions.map((e, i) => <li key={i}>{e}</li>)}</ul>
          </section>
          <section className="card p-6">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Insurance required</div>
            <ul className="mt-3 space-y-1 text-sm text-slate-200 list-disc pl-5">{clauses.insuranceRequired.map((e, i) => <li key={i}>{e}</li>)}</ul>
          </section>
          <section className="card p-6">
            <div className="text-xs uppercase tracking-[0.2em] text-rose-300">Risk flags</div>
            <ul className="mt-3 space-y-1 text-sm text-slate-200 list-disc pl-5">{clauses.riskFlags.map((e, i) => <li key={i}>{e}</li>)}</ul>
          </section>
        </>
      ) : null}
    </AppLayout>
  );
}
