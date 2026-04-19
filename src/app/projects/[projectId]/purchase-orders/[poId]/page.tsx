import { notFound } from "next/navigation";
import Link from "next/link";
import { DetailShell, DetailGrid, DetailField } from "@/components/layout/detail-shell";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function PoDetailPage({ params }: { params: Promise<{ projectId: string; poId: string }> }) {
  const { projectId, poId } = await params;
  const tenant = await requireTenant();
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: poId, project: { id: projectId, tenantId: tenant.id } },
    include: { project: true, vendor: true },
  });
  if (!po) notFound();

  const remaining = po.amount - po.invoicedToDate;
  const invoicedPct = po.amount > 0 ? (po.invoicedToDate / po.amount) * 100 : 0;

  return (
    <DetailShell
      eyebrow={`${po.project.code} · Purchase order`}
      title={po.poNumber}
      subtitle={`${po.vendor.name} · ${po.description}`}
      crumbs={[{ label: "Projects", href: "/projects" }, { label: po.project.code, href: `/projects/${po.project.id}` }, { label: "POs", href: `/projects/${po.project.id}/purchase-orders` }, { label: po.poNumber }]}
      actions={<StatusBadge status={po.status} />}
    >
      <section className="grid gap-4 md:grid-cols-4">
        <StatTile label="Committed" value={formatCurrency(po.amount)} />
        <StatTile label="Invoiced" value={formatCurrency(po.invoicedToDate)} tone="warn" sub={`${Math.round(invoicedPct)}%`} />
        <StatTile label="Remaining" value={formatCurrency(remaining)} tone={remaining > 0 ? "good" : "default"} />
        <StatTile label="Expected delivery" value={formatDate(po.expectedDelivery)} />
      </section>

      <section className="card p-6">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Purchase order detail</div>
        <DetailGrid>
          <DetailField label="Vendor"><Link href={`/vendors/${po.vendor.id}`} className="text-cyan-300 hover:underline">{po.vendor.name}</Link></DetailField>
          <DetailField label="PO number">{po.poNumber}</DetailField>
          <DetailField label="Description">{po.description}</DetailField>
          <DetailField label="Status">{po.status}</DetailField>
          <DetailField label="Issued">{formatDate(po.issuedAt)}</DetailField>
          <DetailField label="Expected delivery">{formatDate(po.expectedDelivery)}</DetailField>
        </DetailGrid>
      </section>
    </DetailShell>
  );
}
