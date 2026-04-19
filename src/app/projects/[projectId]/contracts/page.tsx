import Link from "next/link";
import { notFound } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { ProjectTabs } from "@/components/layout/project-tabs";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { contractTypeLabel, formatCurrency, formatDate, formatPercent } from "@/lib/utils";

export default async function ContractsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const tenant = await requireTenant();
  const project = await prisma.project.findFirst({
    where: { id: projectId, tenantId: tenant.id },
    include: {
      contracts: {
        include: { commitments: true, payApplications: true, lienWaivers: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!project) notFound();

  const totalContracted = project.contracts.reduce((s, c) => s + c.currentValue, 0);
  const invoiced = project.contracts.reduce((s, c) => s + c.commitments.reduce((a, cm) => a + cm.invoicedToDate, 0), 0);
  const paid = project.contracts.reduce((s, c) => s + c.commitments.reduce((a, cm) => a + cm.paidToDate, 0), 0);

  return (
    <AppLayout eyebrow={`${project.code} · Contracts`} title={project.name} description="Prime contracts, subcontracts, purchase orders — with cost commitments and billed/paid positions.">
      <div className="grid gap-6">
        <ProjectTabs projectId={project.id} active="contracts" mode={project.mode} />

        <section className="grid gap-4 md:grid-cols-4">
          <Stat label="Contracts" value={project.contracts.length} />
          <Stat label="Total contracted" value={formatCurrency(totalContracted)} />
          <Stat label="Invoiced to date" value={formatCurrency(invoiced)} tone="warn" />
          <Stat label="Paid to date" value={formatCurrency(paid)} tone="good" />
        </section>

        {project.contracts.map((c) => {
          const committed = c.commitments.reduce((s, cm) => s + cm.committedAmount, 0);
          const cInvoiced = c.commitments.reduce((s, cm) => s + cm.invoicedToDate, 0);
          const cPaid = c.commitments.reduce((s, cm) => s + cm.paidToDate, 0);
          const billedPct = committed === 0 ? 0 : (cInvoiced / committed) * 100;
          return (
            <section key={c.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">{contractTypeLabel(c.type)}</div>
                  <div className="mt-1 text-lg font-semibold text-white">{c.title}</div>
                  <div className="text-xs text-slate-500">{c.counterparty} · {c.contractNumber}</div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <StatusBadge status={c.status} />
                  <div className="text-xs text-slate-400">{formatDate(c.startDate)} → {formatDate(c.endDate)}</div>
                  <Link href={`/projects/${project.id}/contracts/${c.id}`} className="text-xs text-cyan-300 hover:text-cyan-200 hover:underline">View contract detail →</Link>
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <Stat label="Original value" value={formatCurrency(c.originalValue)} />
                <Stat label="Current value" value={formatCurrency(c.currentValue)} />
                <Stat label="Retainage %" value={`${formatPercent(c.retainagePct)}`} />
                <Stat label="Billed vs. committed" value={`${Math.round(billedPct)}%`} tone={billedPct > 95 ? "warn" : "good"} />
              </div>
              {c.commitments.length > 0 ? (
                <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
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
                      {c.commitments.map((cm) => (
                        <tr key={cm.id}>
                          <td className="table-cell font-mono text-xs text-slate-400">{cm.costCode ?? "—"}</td>
                          <td className="table-cell">{cm.description}</td>
                          <td className="table-cell">{formatCurrency(cm.committedAmount)}</td>
                          <td className="table-cell">{formatCurrency(cm.invoicedToDate)}</td>
                          <td className="table-cell">{formatCurrency(cm.paidToDate)}</td>
                          <td className="table-cell">{formatCurrency(cm.committedAmount - cm.invoicedToDate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
              <div className="mt-4 text-xs text-slate-400">
                {c.payApplications.length} pay application{c.payApplications.length === 1 ? "" : "s"} · {c.lienWaivers.length} lien waiver record{c.lienWaivers.length === 1 ? "" : "s"}
              </div>
            </section>
          );
        })}
        {project.contracts.length === 0 ? (
          <div className="card p-8 text-center text-slate-500">No contracts on file.</div>
        ) : null}
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
