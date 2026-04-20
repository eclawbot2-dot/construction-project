import { notFound } from "next/navigation";
import Link from "next/link";
import { DetailShell } from "@/components/layout/detail-shell";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { takeoffFromSow } from "@/lib/estimating-ai";
import { formatCurrency } from "@/lib/utils";

export default async function TakeoffPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sow?: string; area?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const tenant = await requireTenant();
  const draft = await prisma.bidDraft.findFirst({ where: { id, tenantId: tenant.id } });
  if (!draft) notFound();

  const sow = sp.sow ?? "";
  const area = sp.area ? parseInt(sp.area, 10) : undefined;
  const items = sow ? await takeoffFromSow(sow, area) : [];
  const total = items.reduce((s, i) => s + i.amount, 0);

  return (
    <DetailShell
      eyebrow="AI · SOW takeoff"
      title={`Quantity takeoff from scope text`}
      subtitle={`Paste an SOW or RFP Section 02 — the AI extracts quantities per assembly.`}
      crumbs={[{ label: "Bid Hub", href: "/bids" }, { label: draft.title, href: `/bids/drafts/${id}` }, { label: "Takeoff" }]}
    >
      <section className="card p-6">
        <form method="get" className="grid gap-3">
          <label className="text-xs uppercase tracking-[0.2em] text-slate-400">Scope of work text</label>
          <textarea name="sow" defaultValue={sow} rows={8} className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500" placeholder="Paste SOW — the more detail the better…" />
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
            <input name="area" type="number" defaultValue={area} placeholder="Project area (SF)" className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" />
            <button type="submit" className="btn-primary">Run takeoff</button>
            <Link href={`/bids/drafts/${id}`} className="btn-outline text-xs">← back</Link>
          </div>
        </form>
      </section>
      {items.length > 0 ? (
        <section className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-sm">
              <thead className="bg-white/5">
                <tr>
                  <th className="table-header">Code</th>
                  <th className="table-header">Description</th>
                  <th className="table-header">Qty</th>
                  <th className="table-header">Unit</th>
                  <th className="table-header">Unit cost</th>
                  <th className="table-header">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-slate-950/40">
                {items.map((it, i) => (
                  <tr key={i}>
                    <td className="table-cell font-mono text-xs text-slate-400">{it.costCode}</td>
                    <td className="table-cell">{it.description}</td>
                    <td className="table-cell">{it.quantity}</td>
                    <td className="table-cell text-xs text-slate-400">{it.unit}</td>
                    <td className="table-cell">{formatCurrency(it.unitCost)}</td>
                    <td className="table-cell font-semibold text-white">{formatCurrency(it.amount)}</td>
                  </tr>
                ))}
                <tr className="bg-cyan-500/10">
                  <td className="table-cell" colSpan={5}>Takeoff total</td>
                  <td className="table-cell font-semibold text-cyan-100">{formatCurrency(total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      ) : sow ? <div className="text-sm text-slate-500">No assemblies matched — try adding keywords like concrete, steel, electrical, HVAC.</div> : null}
    </DetailShell>
  );
}
