import { notFound } from "next/navigation";
import Link from "next/link";
import { DetailShell, DetailGrid, DetailField } from "@/components/layout/detail-shell";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { contractTypeLabel, formatCurrency, formatDate, formatPercent } from "@/lib/utils";

export default async function ContractDetailPage({ params }: { params: Promise<{ projectId: string; contractId: string }> }) {
  const { projectId, contractId } = await params;
  const tenant = await requireTenant();
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, project: { id: projectId, tenantId: tenant.id } },
    include: { project: true, commitments: true, payApplications: { orderBy: { periodNumber: "asc" } }, lienWaivers: { orderBy: { createdAt: "desc" } } },
  });
  if (!contract) notFound();

  const committed = contract.commitments.reduce((s, c) => s + c.committedAmount, 0);
  const invoiced = contract.commitments.reduce((s, c) => s + c.invoicedToDate, 0);
  const paid = contract.commitments.reduce((s, c) => s + c.paidToDate, 0);

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
        <StatTile label="Current value" value={formatCurrency(contract.currentValue)} sub={`${formatCurrency(contract.currentValue - contract.originalValue)} in COs`} />
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
          <DetailField label="Executed">{formatDate(contract.executedAt)}</DetailField>
          <DetailField label="Notes">{contract.notes ?? "—"}</DetailField>
        </DetailGrid>
      </section>

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
                  <td className="table-cell">{formatCurrency(c.committedAmount - c.invoicedToDate)}</td>
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
    </DetailShell>
  );
}
