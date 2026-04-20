import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { varianceNarrative } from "@/lib/finance-ai";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { formatCurrency } from "@/lib/utils";

export default async function VariancePage({ searchParams }: { searchParams: Promise<{ projectId?: string }> }) {
  const tenant = await requireTenant();
  const sp = await searchParams;
  const projects = await prisma.project.findMany({ where: { tenantId: tenant.id }, select: { id: true, code: true, name: true } });
  const narrative = sp.projectId ? await varianceNarrative(sp.projectId, tenant.id) : null;

  return (
    <AppLayout eyebrow="Finance AI" title="Variance narrator" description="AI-generated plain-English narrative of each budget line's variance vs plan.">
      <form method="get" className="card p-6 flex flex-wrap gap-3 items-center">
        <label className="text-xs uppercase tracking-[0.2em] text-slate-400">Project</label>
        <select name="projectId" defaultValue={sp.projectId ?? ""} className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white">
          <option value="">— select —</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
        </select>
        <button className="btn-primary">Generate</button>
        <Link href="/finance/ai" className="btn-outline text-xs">← back</Link>
      </form>
      {narrative ? (
        <>
          <section className="card p-6 mt-6">
            <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Summary</div>
            <p className="mt-2 text-sm text-slate-200 leading-6">{narrative.summary}</p>
          </section>
          <section className="card p-0 overflow-hidden">
            <table className="min-w-full divide-y divide-white/10 text-sm">
              <thead className="bg-white/5">
                <tr><th className="table-header">Cost code</th><th className="table-header">Variance</th><th className="table-header">Narrative</th></tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-slate-950/40">
                {narrative.byCostCode.map((l, i) => (
                  <tr key={i}><td className="table-cell font-mono text-xs">{l.costCode}</td><td className={"table-cell font-medium " + (l.variance >= 0 ? "text-rose-200" : "text-emerald-200")}>{formatCurrency(l.variance)}</td><td className="table-cell text-xs text-slate-400">{l.narrative}</td></tr>
                ))}
                {narrative.byCostCode.length === 0 ? <tr><td colSpan={3} className="table-cell text-center text-slate-500">No budget lines on file for this project.</td></tr> : null}
              </tbody>
            </table>
          </section>
        </>
      ) : null}
    </AppLayout>
  );
}
