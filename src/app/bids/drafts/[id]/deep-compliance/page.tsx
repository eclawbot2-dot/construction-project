import { notFound } from "next/navigation";
import Link from "next/link";
import { DetailShell } from "@/components/layout/detail-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { deepComplianceCheck } from "@/lib/sales-ai";

export default async function DeepCompliancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await requireTenant();
  const draft = await prisma.bidDraft.findFirst({ where: { id, tenantId: tenant.id } });
  if (!draft) notFound();
  const result = await deepComplianceCheck(id);

  return (
    <DetailShell
      eyebrow="AI · Deep compliance"
      title={`Requirement-by-requirement assessment`}
      subtitle={result.summary}
      crumbs={[{ label: "Bid Hub", href: "/bids" }, { label: draft.title, href: `/bids/drafts/${id}` }, { label: "Deep compliance" }]}
      actions={<StatusBadge status={result.overall} />}
    >
      <section className="card p-0 overflow-hidden">
        <table className="min-w-full divide-y divide-white/10 text-sm">
          <thead className="bg-white/5">
            <tr>
              <th className="table-header">Category</th>
              <th className="table-header">Requirement</th>
              <th className="table-header">Status</th>
              <th className="table-header">Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10 bg-slate-950/40">
            {result.findings.map((f, i) => (
              <tr key={i}>
                <td className="table-cell font-mono text-xs text-slate-400">{f.category}</td>
                <td className="table-cell">{f.requirement}</td>
                <td className="table-cell"><StatusBadge status={f.status} /></td>
                <td className="table-cell text-xs text-slate-400">{f.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <div className="mt-4">
        <Link href={`/bids/drafts/${id}`} className="btn-outline text-xs">← back to draft</Link>
      </div>
    </DetailShell>
  );
}
