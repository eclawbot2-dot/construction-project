import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { extractContractClauses } from "@/lib/compliance-ai";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";

export default async function ClauseExtractPage({ searchParams }: { searchParams: Promise<{ contractId?: string }> }) {
  const tenant = await requireTenant();
  const sp = await searchParams;
  const contracts = await prisma.contract.findMany({ where: { project: { tenantId: tenant.id } }, include: { project: true }, orderBy: { createdAt: "desc" } });
  const clauses = sp.contractId ? await extractContractClauses(sp.contractId, tenant.id) : null;

  return (
    <AppLayout eyebrow="AI · Risk" title="Contract clause extractor" description="Pull liquidated damages, escalation, warranty, exclusions, insurance requirements from a selected contract.">
      <form method="get" className="card p-6 flex flex-wrap gap-3 items-center">
        <label className="text-xs uppercase tracking-[0.2em] text-slate-400">Contract</label>
        <select name="contractId" defaultValue={sp.contractId ?? ""} className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white">
          <option value="">— select —</option>
          {contracts.map((c) => <option key={c.id} value={c.id}>{c.project.code} — {c.contractNumber} — {c.counterparty}</option>)}
        </select>
        <button className="btn-primary">Extract</button>
        <Link href="/risk" className="btn-outline text-xs">← back</Link>
      </form>
      {clauses ? (
        <>
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
