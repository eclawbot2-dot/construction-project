import { notFound } from "next/navigation";
import { DetailShell, DetailGrid, DetailField } from "@/components/layout/detail-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { ApprovalSection, ActivityTrail } from "@/components/approval-section";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { currentActor } from "@/lib/permissions";
import { listComments } from "@/lib/approvals";
import { formatCurrency, formatDate, lienWaiverTypeLabel } from "@/lib/utils";
import { toNum } from "@/lib/money";

export default async function LienWaiverDetailPage({ params }: { params: Promise<{ projectId: string; waiverId: string }> }) {
  const { projectId, waiverId } = await params;
  const tenant = await requireTenant();
  const actor = await currentActor(tenant.id);
  const waiver = await prisma.lienWaiver.findFirst({
    where: { id: waiverId, project: { id: projectId, tenantId: tenant.id } },
    include: { project: true, contract: true },
  });
  if (!waiver) notFound();
  const comments = await listComments(tenant.id, "LienWaiver", waiver.id);

  const throughIso = waiver.throughDate ? new Date(waiver.throughDate).toISOString().slice(0, 10) : "";

  const actions: Array<{ name: string; label: string; tone: "primary" | "outline" | "danger"; requireReason?: boolean; formAction: string }> = [];
  if (waiver.status === "PENDING" && actor.isManager) {
    actions.push({ name: "approve", label: "Accept waiver", tone: "primary", formAction: `/api/lien-waivers/${waiver.id}/approve` });
    actions.push({ name: "reject", label: "Reject", tone: "danger", requireReason: true, formAction: `/api/lien-waivers/${waiver.id}/reject` });
  }

  return (
    <DetailShell
      eyebrow={`${waiver.project.code} · Lien waiver`}
      title={waiver.partyName}
      subtitle={lienWaiverTypeLabel(waiver.waiverType)}
      crumbs={[{ label: "Projects", href: "/projects" }, { label: waiver.project.code, href: `/projects/${waiver.project.id}` }, { label: "Lien waivers", href: `/projects/${waiver.project.id}/lien-waivers` }, { label: waiver.partyName }]}
      actions={<StatusBadge status={waiver.status} />}
    >
      <section className="card p-6">
        <DetailGrid>
          <DetailField label="Party">{waiver.partyName}</DetailField>
          <DetailField label="Type">{lienWaiverTypeLabel(waiver.waiverType)}</DetailField>
          <DetailField label="Through date">{formatDate(waiver.throughDate)}</DetailField>
          <DetailField label="Amount">{formatCurrency(waiver.amount)}</DetailField>
          <DetailField label="Contract">{waiver.contract?.contractNumber ?? "—"}</DetailField>
          <DetailField label="Received">{formatDate(waiver.receivedAt)}{waiver.receivedBy ? ` by ${waiver.receivedBy}` : ""}</DetailField>
          <DetailField label="Rejected">{formatDate(waiver.rejectedAt)}{waiver.rejectedBy ? ` by ${waiver.rejectedBy}` : ""}</DetailField>
          {waiver.documentUrl ? <DetailField label="Document"><a href={waiver.documentUrl} target="_blank" rel="noopener" className="text-cyan-300 hover:underline">Open →</a></DetailField> : null}
          {waiver.notes ? <DetailField label="Notes">{waiver.notes}</DetailField> : null}
          {waiver.approvalNote ? <DetailField label="Accept note">{waiver.approvalNote}</DetailField> : null}
          {waiver.rejectionReason ? <DetailField label="Reject reason"><span className="text-rose-200">{waiver.rejectionReason}</span></DetailField> : null}
        </DetailGrid>
      </section>

      <ApprovalSection title="Actions" status={waiver.status} actions={actions} actorName={actor.userName} actorRole={actor.role} isManager={actor.isManager} />

      {actor.canEdit && waiver.status !== "RECEIVED" ? (
        <section className="card p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Edit waiver</div>
          <form action={`/api/lien-waivers/${waiver.id}/edit`} method="post" className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="md:col-span-2"><label className="form-label">Party name</label><input name="partyName" defaultValue={waiver.partyName} className="form-input" /></div>
            <div><label className="form-label">Amount ($)</label><input name="amount" type="number" step="0.01" defaultValue={toNum(waiver.amount)} className="form-input" /></div>
            <div><label className="form-label">Through date</label><input name="throughDate" type="date" defaultValue={throughIso} className="form-input" /></div>
            <div className="md:col-span-2"><label className="form-label">Notes</label><input name="notes" defaultValue={waiver.notes ?? ""} className="form-input" /></div>
            <div className="md:col-span-3"><button className="btn-primary">Save</button></div>
          </form>
        </section>
      ) : null}

      <ActivityTrail comments={comments} commentAction={`/api/records/LienWaiver/${waiver.id}/comment`} />
    </DetailShell>
  );
}
