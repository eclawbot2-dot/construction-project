import { notFound } from "next/navigation";
import Link from "next/link";
import { DetailShell, DetailGrid, DetailField } from "@/components/layout/detail-shell";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function SubInvoiceDetailPage({ params }: { params: Promise<{ projectId: string; invoiceId: string }> }) {
  const { projectId, invoiceId } = await params;
  const tenant = await requireTenant();
  const inv = await prisma.subInvoice.findFirst({
    where: { id: invoiceId, project: { id: projectId, tenantId: tenant.id } },
    include: { project: true, vendor: true },
  });
  if (!inv) notFound();

  return (
    <DetailShell
      eyebrow={`${inv.project.code} · Sub invoice`}
      title={inv.invoiceNumber}
      subtitle={`${inv.vendor.name} · ${inv.description ?? ""}`}
      crumbs={[{ label: "Projects", href: "/projects" }, { label: inv.project.code, href: `/projects/${inv.project.id}` }, { label: "Sub invoices", href: `/projects/${inv.project.id}/sub-invoices` }, { label: inv.invoiceNumber }]}
      actions={<StatusBadge status={inv.status} />}
    >
      <section className="grid gap-4 md:grid-cols-4">
        <StatTile label="Amount" value={formatCurrency(inv.amount)} />
        <StatTile label="Retainage held" value={formatCurrency(inv.retainageHeld)} tone="warn" />
        <StatTile label="Net due" value={formatCurrency(inv.netDue)} tone={inv.status === "PAID" ? "good" : "warn"} />
        <StatTile label="Waiver" value={inv.waiverReceived ? "Received" : "Pending"} tone={inv.waiverReceived ? "good" : "warn"} />
      </section>

      <section className="card p-6">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Invoice detail</div>
        <DetailGrid>
          <DetailField label="Vendor"><Link href={`/vendors/${inv.vendor.id}`} className="text-cyan-300 hover:underline">{inv.vendor.name}</Link></DetailField>
          <DetailField label="Invoice #">{inv.invoiceNumber}</DetailField>
          <DetailField label="Invoice date">{formatDate(inv.invoiceDate)}</DetailField>
          <DetailField label="Due date">{formatDate(inv.dueDate)}</DetailField>
          <DetailField label="Approved">{formatDate(inv.approvedAt)}</DetailField>
          <DetailField label="Paid">{formatDate(inv.paidAt)}</DetailField>
          <DetailField label="Description">{inv.description ?? "—"}</DetailField>
        </DetailGrid>
      </section>
    </DetailShell>
  );
}
