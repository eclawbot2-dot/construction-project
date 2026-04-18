import { notFound } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { ProjectTabs } from "@/components/layout/project-tabs";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { formatCurrency, formatDate, formatPercent } from "@/lib/utils";

export default async function PayAppsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const tenant = await requireTenant();
  const project = await prisma.project.findFirst({
    where: { id: projectId, tenantId: tenant.id },
    include: {
      payApplications: {
        include: { lines: { orderBy: { lineNumber: "asc" } }, contract: true },
        orderBy: { periodNumber: "asc" },
      },
    },
  });
  if (!project) notFound();

  const totalBilled = project.payApplications.reduce((s, p) => s + p.workCompletedToDate, 0);
  const retentionHeld = project.payApplications.reduce((s, p) => s + p.retainageHeld, 0);
  const pendingPayment = project.payApplications.filter((p) => p.status !== "PAID").reduce((s, p) => s + p.currentPaymentDue, 0);

  return (
    <AppLayout eyebrow={`${project.code} · Pay applications`} title={project.name} description="AIA G702/G703 progress billing with schedule of values, retainage, and approvals.">
      <div className="grid gap-6">
        <ProjectTabs projectId={project.id} active="pay-apps" />

        <section className="grid gap-4 md:grid-cols-4">
          <Stat label="Draws filed" value={project.payApplications.length} />
          <Stat label="Billed to date" value={formatCurrency(totalBilled)} />
          <Stat label="Retainage held" value={formatCurrency(retentionHeld)} tone="warn" />
          <Stat label="Pending payment" value={formatCurrency(pendingPayment)} tone="warn" />
        </section>

        {project.payApplications.map((app) => (
          <section key={app.id} className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Period #{app.periodNumber}</div>
                <div className="mt-1 text-lg font-semibold text-white">{formatDate(app.periodFrom)} → {formatDate(app.periodTo)}</div>
                <div className="text-xs text-slate-500">Contract: {app.contract?.title ?? "—"}</div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <StatusBadge status={app.status} />
                <div className="text-xs text-slate-400">Submitted: {formatDate(app.submittedAt)} · Paid: {formatDate(app.paidAt)}</div>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <Stat label="Original contract" value={formatCurrency(app.originalContractValue)} />
              <Stat label="Net change orders" value={formatCurrency(app.changeOrderValue)} />
              <Stat label="Total contract" value={formatCurrency(app.totalContractValue)} />
              <Stat label="Work completed" value={formatCurrency(app.workCompletedToDate)} tone="good" />
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <Stat label="Retainage held" value={formatCurrency(app.retainageHeld)} tone="warn" />
              <Stat label="Less prev. payments" value={formatCurrency(app.lessPreviousPayments)} />
              <Stat label="Current payment due" value={formatCurrency(app.currentPaymentDue)} tone="good" />
            </div>
            <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
              <table className="min-w-full divide-y divide-white/10">
                <thead className="bg-white/5">
                  <tr>
                    <th className="table-header">#</th>
                    <th className="table-header">Cost code</th>
                    <th className="table-header">Description</th>
                    <th className="table-header">Scheduled value</th>
                    <th className="table-header">Prior</th>
                    <th className="table-header">This period</th>
                    <th className="table-header">Total completed</th>
                    <th className="table-header">% complete</th>
                    <th className="table-header">Balance</th>
                    <th className="table-header">Retainage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 bg-slate-950/40">
                  {app.lines.map((line) => (
                    <tr key={line.id}>
                      <td className="table-cell font-mono text-xs text-slate-400">{line.lineNumber}</td>
                      <td className="table-cell">{line.costCode ?? "—"}</td>
                      <td className="table-cell">{line.description}</td>
                      <td className="table-cell">{formatCurrency(line.scheduledValue)}</td>
                      <td className="table-cell">{formatCurrency(line.workCompletedPrev)}</td>
                      <td className="table-cell">{formatCurrency(line.workCompletedThis)}</td>
                      <td className="table-cell">{formatCurrency(line.totalCompleted)}</td>
                      <td className="table-cell">{formatPercent(line.percentComplete)}</td>
                      <td className="table-cell">{formatCurrency(line.balanceToFinish)}</td>
                      <td className="table-cell">{formatCurrency(line.retainage)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
        {project.payApplications.length === 0 ? <div className="card p-8 text-center text-slate-500">No pay applications filed.</div> : null}
      </div>
    </AppLayout>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: "good" | "warn" | "bad" }) {
  const toneClass = tone === "good" ? "text-emerald-300" : tone === "warn" ? "text-amber-300" : tone === "bad" ? "text-rose-300" : "text-white";
  return (
    <div className="panel p-4">
      <div className="text-xs uppercase tracking-[0.16em] text-slate-400">{label}</div>
      <div className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}
