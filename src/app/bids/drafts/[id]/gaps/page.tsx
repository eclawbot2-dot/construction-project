import { notFound } from "next/navigation";
import Link from "next/link";
import { DetailShell } from "@/components/layout/detail-shell";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { scopeGapCheck } from "@/lib/estimating-ai";

export default async function GapsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await requireTenant();
  const draft = await prisma.bidDraft.findFirst({ where: { id, tenantId: tenant.id } });
  if (!draft) notFound();
  const gaps = await scopeGapCheck(id);

  return (
    <DetailShell
      eyebrow="AI · Scope gaps"
      title={`Likely omissions in ${draft.title}`}
      subtitle={`${gaps.length} typical cost codes not yet captured in this estimate.`}
      crumbs={[{ label: "Bid Hub", href: "/bids" }, { label: draft.title, href: `/bids/drafts/${id}` }, { label: "Gaps" }]}
    >
      {gaps.length === 0 ? (
        <div className="card p-6 text-sm text-slate-300">No material scope gaps detected — estimate covers typical cost codes for this mode.</div>
      ) : (
        <section className="card p-0 overflow-hidden">
          <table className="min-w-full divide-y divide-white/10 text-sm">
            <thead className="bg-white/5">
              <tr>
                <th className="table-header">Cost code</th>
                <th className="table-header">Description</th>
                <th className="table-header">Why</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 bg-slate-950/40">
              {gaps.map((g) => (
                <tr key={g.costCode}>
                  <td className="table-cell font-mono text-xs text-amber-200">{g.costCode}</td>
                  <td className="table-cell">{g.description}</td>
                  <td className="table-cell text-xs text-slate-400">{g.rationale}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      <Link href={`/bids/drafts/${id}`} className="btn-outline text-xs">← back to draft</Link>
    </DetailShell>
  );
}
