import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { draftChangeOrderJustification } from "@/lib/compliance-ai";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";

export default async function CoJustifyPage({ searchParams }: { searchParams: Promise<{ coId?: string }> }) {
  const tenant = await requireTenant();
  const sp = await searchParams;
  const cos = await prisma.changeOrder.findMany({ where: { project: { tenantId: tenant.id } }, include: { project: true }, orderBy: { createdAt: "desc" }, take: 50 });
  const draft = sp.coId ? await draftChangeOrderJustification(sp.coId, tenant.id) : null;

  return (
    <AppLayout eyebrow="AI · Risk" title="Change-order justification drafter" description="Formal narrative + cost breakdown + schedule impact ready for owner submission.">
      <form method="get" className="card p-6 flex flex-wrap gap-3 items-center">
        <label className="text-xs uppercase tracking-[0.2em] text-slate-400">Change order</label>
        <select name="coId" defaultValue={sp.coId ?? ""} className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white">
          <option value="">— select —</option>
          {cos.map((c) => <option key={c.id} value={c.id}>{c.project.code} — {c.coNumber} — {c.title}</option>)}
        </select>
        <button className="btn-primary">Draft</button>
        <Link href="/risk" className="btn-outline text-xs">← back</Link>
      </form>
      {draft ? (
        <>
          <section className="card p-6">
            <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Narrative</div>
            <p className="mt-3 text-sm text-slate-200 whitespace-pre-wrap leading-6">{draft.narrative}</p>
          </section>
          <section className="card p-6">
            <div className="text-xs uppercase tracking-[0.2em] text-emerald-300">Cost breakdown</div>
            <pre className="mt-3 text-sm text-slate-200 font-sans whitespace-pre-wrap leading-6">{draft.costBreakdown}</pre>
          </section>
          <section className="card p-6">
            <div className="text-xs uppercase tracking-[0.2em] text-amber-300">Schedule impact</div>
            <p className="mt-3 text-sm text-slate-200 leading-6">{draft.scheduleImpact}</p>
          </section>
        </>
      ) : null}
    </AppLayout>
  );
}
