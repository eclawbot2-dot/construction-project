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
import { contractTypeLabel, formatCurrency, formatDate, formatPercent } from "@/lib/utils";
import { sumMoney, subtractMoney, toNum } from "@/lib/money";

export default async function ContractDetailPage({ params }: { params: Promise<{ projectId: string; contractId: string }> }) {
  const { projectId, contractId } = await params;
  const tenant = await requireTenant();
  const actor = await currentActor(tenant.id);
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, project: { id: projectId, tenantId: tenant.id } },
    include: { project: true, commitments: true, payApplications: { orderBy: { periodNumber: "asc" } }, lienWaivers: { orderBy: { createdAt: "desc" } } },
  });
  if (!contract) notFound();
  const comments = await listComments(tenant.id, "Contract", contract.id);

  const committed = sumMoney(contract.commitments.map((c) => c.committedAmount));
  const invoiced = sumMoney(contract.commitments.map((c) => c.invoicedToDate));
  const paid = sumMoney(contract.commitments.map((c) => c.paidToDate));
  const startIso = contract.startDate ? new Date(contract.startDate).toISOString().slice(0, 10) : "";
  const endIso = contract.endDate ? new Date(contract.endDate).toISOString().slice(0, 10) : "";

  const actions: Array<{ name: string; label: string; tone: "primary" | "outline" | "danger"; requireReason?: boolean; formAction: string }> = [];
  if ((contract.status === "DRAFT" || contract.status === "NEGOTIATING") && actor.isManager) {
    actions.push({ name: "execute", label: "Execute contract", tone: "primary", formAction: `/api/contracts/${contract.id}/execute` });
    actions.push({ name: "reject", label: "Terminate", tone: "danger", requireReason: true, formAction: `/api/contracts/${contract.id}/reject` });
  }

  return (
    <DetailShell
      eyebrow={`${contract.project.code} · ${contractTypeLabel(contract.type)}`}
      title={contract.title}
      subtitle={`${contract.counterparty} · ${contract.contractNumber}`}
      crumbs={[{ label: "Projects", href: "/projects" }, { label: contract.project.code, href: `/projects/${contract.project.id}` }, { label: "Contracts", href: `/projects/${contract.project.id}/contracts` }, { label: contract.contractNumber }]}
      actions={<StatusBadge status={contract.status} />}
    >
      <section className="grid gap-4 md:grid-cols-4">
        <StatTile label="Original value" value={formatCurrency(contract.originalValue)} />
        <StatTile label="Current value" value={formatCurrency(contract.currentValue)} sub={`${formatCurrency(subtractMoney(contract.currentValue, contract.originalValue))} in COs`} />
        <StatTile label="Retainage %" value={`${contract.retainagePct}%`} />
        <StatTile label="Billed vs. committed" value={committed ? formatPercent((invoiced / committed) * 100) : "—"} tone={invoiced > committed * 0.95 ? "warn" : "good"} />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <StatTile label="Committed" value={formatCurrency(committed)} />
        <StatTile label="Invoiced to date" value={formatCurrency(invoiced)} tone="warn" />
        <StatTile label="Paid to date" value={formatCurrency(paid)} tone="good" />
      </section>

      <section className="card p-6">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Contract detail</div>
        <DetailGrid>
          <DetailField label="Contract number">{contract.contractNumber}</DetailField>
          <DetailField label="Type">{contractTypeLabel(contract.type)}</DetailField>
          <DetailField label="Counterparty">{contract.counterparty}</DetailField>
          <DetailField label="Start">{formatDate(contract.startDate)}</DetailField>
          <DetailField label="End">{formatDate(contract.endDate)}</DetailField>
          <DetailField label="Executed">{formatDate(contract.executedAt)}{contract.executedBy ? ` by ${contract.executedBy}` : ""}</DetailField>
          <DetailField label="Approved">{formatDate(contract.approvedAt)}{contract.approvedBy ? ` by ${contract.approvedBy}` : ""}</DetailField>
          <DetailField label="Terminated">{formatDate(contract.rejectedAt)}{contract.rejectedBy ? ` by ${contract.rejectedBy}` : ""}</DetailField>
          <DetailField label="Notes">{contract.notes ?? "—"}</DetailField>
          {contract.approvalNote ? <DetailField label="Execute note">{contract.approvalNote}</DetailField> : null}
          {contract.rejectionReason ? <DetailField label="Termination reason"><span className="text-rose-200">{contract.rejectionReason}</span></DetailField> : null}
        </DetailGrid>
      </section>

      <ApprovalSection title="Actions" status={contract.status} actions={actions} actorName={actor.userName} actorRole={actor.role} isManager={actor.isManager} />

      {actor.canEdit && contract.status !== "TERMINATED" && contract.status !== "COMPLETED" ? (
        <section className="card p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Edit contract</div>
          <form action={`/api/contracts/${contract.id}/edit`} method="post" className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="md:col-span-2"><label className="form-label">Title</label><input name="title" defaultValue={contract.title} className="form-input" /></div>
            <div><label className="form-label">Current value ($)</label><input name="currentValue" type="number" step="0.01" defaultValue={toNum(contract.currentValue)} className="form-input" /></div>
            <div><label className="form-label">Retainage %</label><input name="retainagePct" type="number" step="0.01" defaultValue={contract.retainagePct} className="form-input" /></div>
            <div><label className="form-label">Start</label><input name="startDate" type="date" defaultValue={startIso} className="form-input" /></div>
            <div><label className="form-label">End</label><input name="endDate" type="date" defaultValue={endIso} className="form-input" /></div>
            <div className="md:col-span-3"><label className="form-label">Notes</label><textarea name="notes" defaultValue={contract.notes ?? ""} rows={2} className="form-textarea" /></div>
            <div className="md:col-span-3"><button className="btn-primary">Save</button></div>
          </form>
        </section>
      ) : null}

      <section className="card p-0 overflow-hidden">
        <div className="px-5 py-3 text-xs uppercase tracking-[0.2em] text-slate-400">Commitments</div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10">
            <thead className="bg-white/5">
              <tr>
                <th className="table-header">Cost code</th>
                <th className="table-header">Description</th>
                <th className="table-header">Committed</th>
                <th className="table-header">Invoiced</th>
                <th className="table-header">Paid</th>
                <th className="table-header">Remaining</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 bg-slate-950/40">
              {contract.commitments.map((c) => (
                <tr key={c.id}>
                  <td className="table-cell font-mono text-xs text-slate-400">{c.costCode ?? "—"}</td>
                  <td className="table-cell">{c.description}</td>
                  <td className="table-cell">{formatCurrency(c.committedAmount)}</td>
                  <td className="table-cell">{formatCurrency(c.invoicedToDate)}</td>
                  <td className="table-cell">{formatCurrency(c.paidToDate)}</td>
                  <td className="table-cell">{formatCurrency(subtractMoney(c.committedAmount, c.invoicedToDate))}</td>
                </tr>
              ))}
              {contract.commitments.length === 0 ? <tr><td colSpan={6} className="table-cell text-center text-slate-500">No commitments.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card p-0 overflow-hidden">
        <div className="px-5 py-3 text-xs uppercase tracking-[0.2em] text-slate-400">Pay applications against this contract</div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10">
            <thead className="bg-white/5">
              <tr>
                <th className="table-header">Period</th>
                <th className="table-header">Range</th>
                <th className="table-header">Work completed</th>
                <th className="table-header">Retainage</th>
                <th className="table-header">Payment due</th>
                <th className="table-header">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 bg-slate-950/40">
              {contract.payApplications.map((p) => (
                <tr key={p.id} className="transition hover:bg-white/5">
                  <td className="table-cell font-mono text-xs"><Link href={`/projects/${contract.project.id}/pay-apps/${p.id}`} className="text-cyan-300 hover:underline">#{p.periodNumber}</Link></td>
                  <td className="table-cell text-slate-400">{formatDate(p.periodFrom)} → {formatDate(p.periodTo)}</td>
                  <td className="table-cell">{formatCurrency(p.workCompletedToDate)}</td>
                  <td className="table-cell">{formatCurrency(p.retainageHeld)}</td>
                  <td className="table-cell">{formatCurrency(p.currentPaymentDue)}</td>
                  <td className="table-cell"><StatusBadge status={p.status} /></td>
                </tr>
              ))}
              {contract.payApplications.length === 0 ? <tr><td colSpan={6} className="table-cell text-center text-slate-500">No pay apps filed.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card p-0 overflow-hidden">
        <div className="px-5 py-3 text-xs uppercase tracking-[0.2em] text-slate-400">Lien waivers</div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10">
            <thead className="bg-white/5">
              <tr>
                <th className="table-header">Party</th>
                <th className="table-header">Type</th>
                <th className="table-header">Through</th>
                <th className="table-header">Amount</th>
                <th className="table-header">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 bg-slate-950/40">
              {contract.lienWaivers.map((w) => (
                <tr key={w.id}>
                  <td className="table-cell">{w.partyName}</td>
                  <td className="table-cell">{w.waiverType.replaceAll("_", " ")}</td>
                  <td className="table-cell text-slate-400">{formatDate(w.throughDate)}</td>
                  <td className="table-cell">{formatCurrency(w.amount)}</td>
                  <td className="table-cell"><StatusBadge status={w.status} /></td>
                </tr>
              ))}
              {contract.lienWaivers.length === 0 ? <tr><td colSpan={5} className="table-cell text-center text-slate-500">No lien waivers.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <ActivityTrail comments={comments} commentAction={`/api/records/Contract/${contract.id}/comment`} />
    </DetailShell>
  );
}
