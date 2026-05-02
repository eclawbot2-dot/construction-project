import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { formatCurrency, formatDate, formatPercent, contractTypeLabel, changeOrderKindLabel } from "@/lib/utils";
import { sumMoney } from "@/lib/money";

export default async function CommercialPage() {
  const tenant = await requireTenant();
  const projectScope = { project: { tenantId: tenant.id } } as const;
  const [projects, contracts, changeOrders, payApps, lienWaivers] = await Promise.all([
    prisma.project.findMany({ where: { tenantId: tenant.id }, orderBy: { name: "asc" } }),
    prisma.contract.findMany({ where: projectScope, include: { project: true, commitments: true } }),
    prisma.changeOrder.findMany({ where: projectScope, include: { project: true }, orderBy: { requestedAt: "desc" } }),
    prisma.payApplication.findMany({ where: projectScope, include: { project: true, contract: true }, orderBy: { periodNumber: "desc" } }),
    prisma.lienWaiver.findMany({ where: projectScope, include: { project: true, contract: true }, orderBy: { createdAt: "desc" } }),
  ]);

  const contractedValue = sumMoney(contracts.map((c) => c.currentValue));
  const coApproved = sumMoney(changeOrders.filter((c) => c.status === "APPROVED" || c.status === "EXECUTED").map((c) => c.amount));
  const coPending = sumMoney(changeOrders.filter((c) => c.status === "PENDING" || c.status === "DRAFT").map((c) => c.amount));
  const billedToDate = sumMoney(payApps.map((p) => p.workCompletedToDate));
  const retainageHeld = sumMoney(payApps.map((p) => p.retainageHeld));
  const pendingPayment = sumMoney(payApps.filter((p) => p.status !== "PAID").map((p) => p.currentPaymentDue));
  const waiverPending = lienWaivers.filter((w) => w.status === "PENDING").length;

  return (
    <AppLayout eyebrow="Commercial controls" title="Commercial rollup" description="Contracts, change orders, progress billing, and lien waivers across every project.">
      <div className="grid gap-6">
        <section className="grid gap-4 md:grid-cols-4">
          <Stat label="Projects" value={projects.length} href="/projects" />
          <Stat label="Contracted value" value={formatCurrency(contractedValue)} />
          <Stat label="Billed to date" value={formatCurrency(billedToDate)} tone="good" />
          <Stat label="Pending payment" value={formatCurrency(pendingPayment)} tone="warn" />
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <Stat label="Change orders approved" value={formatCurrency(coApproved)} tone="good" />
          <Stat label="Change orders pending" value={formatCurrency(coPending)} tone="warn" />
          <Stat label="Retainage held" value={formatCurrency(retainageHeld)} />
          <Stat label="Lien waivers pending" value={waiverPending} tone={waiverPending > 0 ? "warn" : "good"} />
        </section>

        <section className="card p-0 overflow-hidden">
          <div className="px-5 py-3 text-xs uppercase tracking-[0.2em] text-slate-400">Contract ledger</div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-white/5">
                <tr>
                  <th className="table-header">Contract</th>
                  <th className="table-header">Project</th>
                  <th className="table-header">Type</th>
                  <th className="table-header">Counterparty</th>
                  <th className="table-header">Current value</th>
                  <th className="table-header">Retainage</th>
                  <th className="table-header">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-slate-950/40">
                {contracts.map((c) => (
                  <tr key={c.id} className="cursor-pointer transition hover:bg-white/5">
                    <td className="table-cell">
                      <Link href={`/projects/${c.project.id}/contracts/${c.id}`} className="text-cyan-300 hover:text-cyan-200 hover:underline">
                        <div className="font-medium">{c.contractNumber}</div>
                        <div className="text-xs text-slate-500">{c.title}</div>
                      </Link>
                    </td>
                    <td className="table-cell"><Link href={`/projects/${c.project.id}`} className="text-cyan-300 hover:underline">{c.project.code}</Link></td>
                    <td className="table-cell">{contractTypeLabel(c.type)}</td>
                    <td className="table-cell text-slate-400">{c.counterparty}</td>
                    <td className="table-cell">{formatCurrency(c.currentValue)}</td>
                    <td className="table-cell">{formatPercent(c.retainagePct)}</td>
                    <td className="table-cell"><StatusBadge status={c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card p-0 overflow-hidden">
          <div className="px-5 py-3 text-xs uppercase tracking-[0.2em] text-slate-400">Change order ledger</div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-white/5">
                <tr>
                  <th className="table-header">#</th>
                  <th className="table-header">Project</th>
                  <th className="table-header">Kind</th>
                  <th className="table-header">Title</th>
                  <th className="table-header">Amount</th>
                  <th className="table-header">Schedule</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Requested</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-slate-950/40">
                {changeOrders.map((co) => (
                  <tr key={co.id} className="cursor-pointer transition hover:bg-white/5">
                    <td className="table-cell font-mono text-xs text-slate-400">{co.coNumber}</td>
                    <td className="table-cell"><Link href={`/projects/${co.project.id}/change-orders`} className="text-cyan-300 hover:underline">{co.project.code}</Link></td>
                    <td className="table-cell">{changeOrderKindLabel(co.kind)}</td>
                    <td className="table-cell"><Link href={`/projects/${co.project.id}/change-orders/${co.id}`} className="text-cyan-300 hover:text-cyan-200 hover:underline">{co.title}</Link></td>
                    <td className="table-cell">{formatCurrency(co.amount)}</td>
                    <td className="table-cell">{co.scheduleImpactDays ? `${co.scheduleImpactDays}d` : "—"}</td>
                    <td className="table-cell"><StatusBadge status={co.status} /></td>
                    <td className="table-cell text-slate-400">{formatDate(co.requestedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card p-0 overflow-hidden">
          <div className="px-5 py-3 text-xs uppercase tracking-[0.2em] text-slate-400">Pay application pipeline</div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-white/5">
                <tr>
                  <th className="table-header">Project</th>
                  <th className="table-header">Period</th>
                  <th className="table-header">Range</th>
                  <th className="table-header">Work completed</th>
                  <th className="table-header">Retainage</th>
                  <th className="table-header">Payment due</th>
                  <th className="table-header">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-slate-950/40">
                {payApps.map((p) => (
                  <tr key={p.id} className="cursor-pointer transition hover:bg-white/5">
                    <td className="table-cell"><Link href={`/projects/${p.project.id}/pay-apps`} className="text-cyan-300 hover:underline">{p.project.code}</Link></td>
                    <td className="table-cell font-mono text-xs"><Link href={`/projects/${p.project.id}/pay-apps/${p.id}`} className="text-cyan-300 hover:text-cyan-200 hover:underline">#{p.periodNumber}</Link></td>
                    <td className="table-cell text-slate-400">{formatDate(p.periodFrom)} → {formatDate(p.periodTo)}</td>
                    <td className="table-cell">{formatCurrency(p.workCompletedToDate)}</td>
                    <td className="table-cell">{formatCurrency(p.retainageHeld)}</td>
                    <td className="table-cell">{formatCurrency(p.currentPaymentDue)}</td>
                    <td className="table-cell"><StatusBadge status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}

function Stat({ label, value, tone, href }: { label: string; value: string | number; tone?: "good" | "warn" | "bad"; href?: string }) {
  const toneClass = tone === "good" ? "text-emerald-300" : tone === "warn" ? "text-amber-300" : tone === "bad" ? "text-rose-300" : "text-white";
  const inner = (
    <div className={`panel p-4 ${href ? "transition hover:border-cyan-500/40" : ""}`}>
      <div className="text-xs uppercase tracking-[0.16em] text-slate-400">{label}</div>
      <div className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</div>
      {href ? <div className="mt-1 text-[10px] uppercase tracking-[0.22em] text-cyan-300">View →</div> : null}
    </div>
  );
  return href ? <Link href={href} className="block">{inner}</Link> : inner;
}
