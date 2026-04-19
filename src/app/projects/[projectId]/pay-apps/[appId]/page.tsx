import { notFound } from "next/navigation";
import { DetailShell, DetailGrid, DetailField } from "@/components/layout/detail-shell";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusBadge } from "@/components/ui/status-badge";
import { PrintButton } from "@/components/ui/print-button";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { formatCurrency, formatDate, formatPercent } from "@/lib/utils";

export default async function PayAppDetailPage({ params }: { params: Promise<{ projectId: string; appId: string }> }) {
  const { projectId, appId } = await params;
  const tenant = await requireTenant();
  const app = await prisma.payApplication.findFirst({
    where: { id: appId, project: { id: projectId, tenantId: tenant.id } },
    include: { project: true, contract: true, lines: { orderBy: { lineNumber: "asc" } } },
  });
  if (!app) notFound();

  const totalScheduled = app.lines.reduce((s, l) => s + l.scheduledValue, 0);
  const totalCompleted = app.lines.reduce((s, l) => s + l.totalCompleted, 0);
  const overallPct = totalScheduled > 0 ? (totalCompleted / totalScheduled) * 100 : 0;

  return (
    <DetailShell
      eyebrow={`${app.project.code} · Pay app #${app.periodNumber}`}
      title={`AIA G702/G703 — ${formatDate(app.periodFrom)} → ${formatDate(app.periodTo)}`}
      subtitle={app.contract ? `Against ${app.contract.title}` : undefined}
      crumbs={[{ label: "Projects", href: "/projects" }, { label: app.project.code, href: `/projects/${app.project.id}` }, { label: "Pay apps", href: `/projects/${app.project.id}/pay-apps` }, { label: `#${app.periodNumber}` }]}
      actions={(
        <div className="flex items-center gap-2">
          <StatusBadge status={app.status} />
          <PrintButton label="Print G702/G703" />
        </div>
      )}
    >
      <section className="grid gap-4 md:grid-cols-4">
        <StatTile label="Original contract" value={formatCurrency(app.originalContractValue)} />
        <StatTile label="Change orders" value={formatCurrency(app.changeOrderValue)} tone={app.changeOrderValue > 0 ? "warn" : "default"} />
        <StatTile label="Current contract" value={formatCurrency(app.totalContractValue)} />
        <StatTile label="Overall % complete" value={formatPercent(overallPct)} tone={overallPct >= 50 ? "good" : "warn"} />
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <StatTile label="Work completed" value={formatCurrency(app.workCompletedToDate)} tone="good" />
        <StatTile label="Materials stored" value={formatCurrency(app.materialsStoredToDate)} />
        <StatTile label="Retainage held" value={formatCurrency(app.retainageHeld)} sub={`${app.retainagePct}%`} tone="warn" />
        <StatTile label="Payment due now" value={formatCurrency(app.currentPaymentDue)} tone={app.currentPaymentDue > 0 ? "good" : "default"} />
      </section>

      <section className="card p-6">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Application detail</div>
        <DetailGrid>
          <DetailField label="Period">{formatDate(app.periodFrom)} → {formatDate(app.periodTo)}</DetailField>
          <DetailField label="Contract">{app.contract?.contractNumber ?? "—"}</DetailField>
          <DetailField label="Submitted">{formatDate(app.submittedAt)}</DetailField>
          <DetailField label="Approved">{formatDate(app.approvedAt)}</DetailField>
          <DetailField label="Paid">{formatDate(app.paidAt)}</DetailField>
          <DetailField label="Less previous payments">{formatCurrency(app.lessPreviousPayments)}</DetailField>
          <DetailField label="Notes">{app.notes ?? "—"}</DetailField>
        </DetailGrid>
      </section>

      <section className="card p-0 overflow-hidden">
        <div className="px-5 py-3 text-xs uppercase tracking-[0.2em] text-slate-400">Schedule of values (G703)</div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10">
            <thead className="bg-white/5">
              <tr>
                <th className="table-header">Line</th>
                <th className="table-header">Cost code</th>
                <th className="table-header">Description</th>
                <th className="table-header">Scheduled value</th>
                <th className="table-header">Prior work</th>
                <th className="table-header">This period</th>
                <th className="table-header">Materials stored</th>
                <th className="table-header">Total completed</th>
                <th className="table-header">% complete</th>
                <th className="table-header">Balance to finish</th>
                <th className="table-header">Retainage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 bg-slate-950/40">
              {app.lines.map((l) => (
                <tr key={l.id} className="transition hover:bg-white/5">
                  <td className="table-cell font-mono text-xs text-slate-400">{l.lineNumber}</td>
                  <td className="table-cell font-mono text-xs text-slate-400">{l.costCode ?? "—"}</td>
                  <td className="table-cell">{l.description}</td>
                  <td className="table-cell">{formatCurrency(l.scheduledValue)}</td>
                  <td className="table-cell text-slate-400">{formatCurrency(l.workCompletedPrev)}</td>
                  <td className="table-cell font-medium text-white">{formatCurrency(l.workCompletedThis)}</td>
                  <td className="table-cell">{formatCurrency(l.materialsStored)}</td>
                  <td className="table-cell">{formatCurrency(l.totalCompleted)}</td>
                  <td className="table-cell">{formatPercent(l.percentComplete)}</td>
                  <td className="table-cell text-slate-400">{formatCurrency(l.balanceToFinish)}</td>
                  <td className="table-cell">{formatCurrency(l.retainage)}</td>
                </tr>
              ))}
              <tr className="bg-white/5">
                <td className="table-cell" colSpan={3}><span className="text-slate-400">Total</span></td>
                <td className="table-cell font-semibold text-white">{formatCurrency(totalScheduled)}</td>
                <td colSpan={3} className="table-cell" />
                <td className="table-cell font-semibold text-white">{formatCurrency(totalCompleted)}</td>
                <td className="table-cell font-semibold text-white">{formatPercent(overallPct)}</td>
                <td className="table-cell font-semibold text-white">{formatCurrency(totalScheduled - totalCompleted)}</td>
                <td className="table-cell font-semibold text-white">{formatCurrency(app.retainageHeld)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </DetailShell>
  );
}
