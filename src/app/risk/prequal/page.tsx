import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { prequalAutoFill } from "@/lib/compliance-ai";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";

export default async function PrequalPage({ searchParams }: { searchParams: Promise<{ vendorId?: string }> }) {
  const tenant = await requireTenant();
  const sp = await searchParams;
  const vendors = await prisma.vendor.findMany({ where: { tenantId: tenant.id }, orderBy: { name: "asc" }, take: 200 });
  const form = sp.vendorId ? await prequalAutoFill(sp.vendorId, tenant.id) : null;

  return (
    <AppLayout eyebrow="AI · Risk" title="Prequalification auto-fill" description="Prefill standard prequal questionnaire from vendor profile data.">
      <form method="get" className="card p-6 flex flex-wrap gap-3 items-center">
        <label className="text-xs uppercase tracking-[0.2em] text-slate-400">Vendor</label>
        <select name="vendorId" defaultValue={sp.vendorId ?? ""} className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white">
          <option value="">— select —</option>
          {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
        <button className="btn-primary">Fill</button>
        <Link href="/risk" className="btn-outline text-xs">← back</Link>
      </form>
      {form ? (
        <>
          <section className="card p-6">
            <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Company info</div>
            <div className="mt-3 grid gap-2 md:grid-cols-2 text-sm text-slate-200">
              {Object.entries(form.companyInfo).map(([k, v]) => <div key={k}><span className="text-slate-500 text-xs">{k}:</span> <span className="text-white font-medium">{v}</span></div>)}
            </div>
          </section>
          <section className="card p-6">
            <div className="text-xs uppercase tracking-[0.2em] text-emerald-300">Safety record</div>
            <div className="mt-3 grid gap-2 md:grid-cols-2 text-sm text-slate-200">
              {Object.entries(form.safetyRecord).map(([k, v]) => <div key={k}><span className="text-slate-500 text-xs">{k}:</span> <span className="text-white font-medium">{v}</span></div>)}
            </div>
          </section>
          <section className="card p-6">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">References</div>
            <ul className="mt-3 space-y-1 text-sm text-slate-200 list-disc pl-5">{form.references.map((r, i) => <li key={i}>{r.project} — {r.value} — {r.role}</li>)}</ul>
          </section>
          <section className="card p-6">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Certifications</div>
            <ul className="mt-3 space-y-1 text-sm text-slate-200 list-disc pl-5">{form.certifications.map((c, i) => <li key={i}>{c}</li>)}</ul>
          </section>
        </>
      ) : null}
    </AppLayout>
  );
}
