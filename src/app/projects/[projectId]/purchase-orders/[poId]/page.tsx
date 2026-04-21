import { notFound } from "next/navigation";
import Link from "next/link";
import { DetailShell, DetailGrid, DetailField } from "@/components/layout/detail-shell";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusBadge } from "@/components/ui/status-badge";
import { ApprovalSection, ActivityTrail } from "@/components/approval-section";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { currentActor } from "@/lib/permissions";
import { listComments } from "@/lib/approvals";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function PoDetailPage({ params }: { params: Promise<{ projectId: string; poId: string }> }) {
  const { projectId, poId } = await params;
  const tenant = await requireTenant();
  const actor = await currentActor(tenant.id);
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: poId, project: { id: projectId, tenantId: tenant.id } },
    include: { project: true, vendor: true },
  });
  if (!po) notFound();
  const comments = await listComments(tenant.id, "PurchaseOrder", po.id);

  const remaining = po.amount - po.invoicedToDate;
  const invoicedPct = po.amount > 0 ? (po.invoicedToDate / po.amount) * 100 : 0;
  const edIso = po.expectedDelivery ? new Date(po.expectedDelivery).toISOString().slice(0, 10) : "";

  const actions: Array<{ name: string; label: string; tone: "primary" | "outline" | "danger"; requireReason?: boolean; formAction: string }> = [];
  if (po.status === "OPEN" && actor.isManager) actions.push({ name: "approve", label: "Approve / issue", tone: "primary", formAction: `/api/purchase-orders/${po.id}/approve` });
  if ((po.status === "OPEN" || po.status === "APPROVED" || po.status === "PARTIAL") && actor.isManager) actions.push({ name: "close", label: "Close out", tone: "outline", formAction: `/api/purchase-orders/${po.id}/close` });

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
          <DetailField label="Issued">{formatDate(po.issuedAt)}{po.issuedBy ? ` by ${po.issuedBy}` : ""}</DetailField>
          <DetailField label="Approved">{formatDate(po.approvedAt)}{po.approvedBy ? ` by ${po.approvedBy}` : ""}</DetailField>
          <DetailField label="Closed">{formatDate(po.closedAt)}{po.closedBy ? ` by ${po.closedBy}` : ""}</DetailField>
          <DetailField label="Expected delivery">{formatDate(po.expectedDelivery)}</DetailField>
          {po.approvalNote ? <DetailField label="Approval note">{po.approvalNote}</DetailField> : null}
          {po.notes ? <DetailField label="Notes">{po.notes}</DetailField> : null}
        </DetailGrid>
      </section>

      <ApprovalSection title="Actions" status={po.status} actions={actions} actorName={actor.userName} actorRole={actor.role} isManager={actor.isManager} />

      {actor.canEdit && po.status !== "CLOSED" ? (
        <section className="card p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Edit PO</div>
          <form action={`/api/purchase-orders/${po.id}/edit`} method="post" className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="md:col-span-2"><label className="form-label">Description</label><input name="description" defaultValue={po.description} className="form-input" /></div>
            <div><label className="form-label">Amount ($)</label><input name="amount" type="number" step="0.01" defaultValue={po.amount} className="form-input" /></div>
            <div><label className="form-label">Expected delivery</label><input name="expectedDelivery" type="date" defaultValue={edIso} className="form-input" /></div>
            <div className="md:col-span-2"><label className="form-label">Notes</label><input name="notes" defaultValue={po.notes ?? ""} className="form-input" /></div>
            <div className="md:col-span-3"><button className="btn-primary">Save</button></div>
          </form>
        </section>
      ) : null}

      <ActivityTrail comments={comments} commentAction={`/api/records/PurchaseOrder/${po.id}/comment`} />
    </DetailShell>
  );
}
