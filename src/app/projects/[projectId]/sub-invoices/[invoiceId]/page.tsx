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

export default async function SubInvoiceDetailPage({ params }: { params: Promise<{ projectId: string; invoiceId: string }> }) {
  const { projectId, invoiceId } = await params;
  const tenant = await requireTenant();
  const actor = await currentActor(tenant.id);
  const inv = await prisma.subInvoice.findFirst({
    where: { id: invoiceId, project: { id: projectId, tenantId: tenant.id } },
    include: { project: true, vendor: true },
  });
  if (!inv) notFound();
  const comments = await listComments(tenant.id, "SubInvoice", inv.id);

  const actions: Array<{ name: string; label: string; tone: "primary" | "outline" | "danger"; requireReason?: boolean; formAction: string }> = [];
  if ((inv.status === "RECEIVED" || inv.status === "UNDER_REVIEW") && actor.isManager) {
    actions.push({ name: "approve", label: "Approve for payment", tone: "primary", formAction: `/api/sub-invoices/${inv.id}/approve` });
    actions.push({ name: "reject", label: "Reject / dispute", tone: "danger", requireReason: true, formAction: `/api/sub-invoices/${inv.id}/reject` });
  }
  if (inv.status === "APPROVED" && actor.isManager) actions.push({ name: "pay", label: "Mark paid", tone: "primary", formAction: `/api/sub-invoices/${inv.id}/pay` });

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
          <DetailField label="Approved">{formatDate(inv.approvedAt)}{inv.approvedBy ? ` by ${inv.approvedBy}` : ""}</DetailField>
          <DetailField label="Rejected">{formatDate(inv.rejectedAt)}{inv.rejectedBy ? ` by ${inv.rejectedBy}` : ""}</DetailField>
          <DetailField label="Paid">{formatDate(inv.paidAt)}{inv.paidBy ? ` by ${inv.paidBy}` : ""}</DetailField>
          <DetailField label="Description">{inv.description ?? "—"}</DetailField>
          {inv.approvalNote ? <DetailField label="Approval note">{inv.approvalNote}</DetailField> : null}
          {inv.rejectionReason ? <DetailField label="Rejection reason"><span className="text-rose-200">{inv.rejectionReason}</span></DetailField> : null}
        </DetailGrid>
      </section>

      <ApprovalSection title="Actions" status={inv.status} actions={actions} actorName={actor.userName} actorRole={actor.role} isManager={actor.isManager} />

      {actor.canEdit && inv.status !== "PAID" ? (
        <section className="card p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Edit invoice</div>
          <form action={`/api/sub-invoices/${inv.id}/edit`} method="post" className="mt-4 grid gap-3 md:grid-cols-3">
            <div><label className="form-label">Amount ($)</label><input name="amount" type="number" step="0.01" defaultValue={inv.amount} className="form-input" /></div>
            <div><label className="form-label">Retainage held ($)</label><input name="retainageHeld" type="number" step="0.01" defaultValue={inv.retainageHeld} className="form-input" /></div>
            <div><label className="form-label">Net due ($)</label><input name="netDue" type="number" step="0.01" defaultValue={inv.netDue} className="form-input" /></div>
            <div className="md:col-span-3"><label className="form-label">Notes</label><input name="notes" defaultValue={inv.notes ?? ""} className="form-input" /></div>
            <div className="md:col-span-3"><button className="btn-primary">Save</button></div>
          </form>
        </section>
      ) : null}

      <ActivityTrail comments={comments} commentAction={`/api/records/SubInvoice/${inv.id}/comment`} />
    </DetailShell>
  );
}
