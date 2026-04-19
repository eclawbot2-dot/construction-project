import Link from "next/link";
import { notFound } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { ProjectTabs } from "@/components/layout/project-tabs";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatTile } from "@/components/ui/stat-tile";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function BidsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const tenant = await requireTenant();
  const project = await prisma.project.findFirst({
    where: { id: projectId, tenantId: tenant.id },
    include: {
      bidPackages: {
        include: { subBids: { include: { vendor: true }, orderBy: { bidAmount: "asc" } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!project) notFound();

  const totalPackages = project.bidPackages.length;
  const totalInvited = project.bidPackages.reduce((s, p) => s + p.subBids.length, 0);
  const selected = project.bidPackages.reduce((s, p) => s + p.subBids.filter((b) => b.status === "SELECTED").length, 0);
  const committedValue = project.bidPackages.reduce((s, p) => s + p.subBids.filter((b) => b.status === "SELECTED").reduce((a, b) => a + (b.bidAmount ?? 0), 0), 0);

  return (
    <AppLayout eyebrow={`${project.code} · Bid packages`} title={project.name} description="Trade bid packages with sub invites, bid leveling, and selection.">
      <div className="grid gap-6">
        <ProjectTabs projectId={project.id} active="bids" />
        <section className="grid gap-4 md:grid-cols-4">
          <StatTile label="Bid packages" value={totalPackages} />
          <StatTile label="Subs invited" value={totalInvited} />
          <StatTile label="Selected" value={selected} tone="good" />
          <StatTile label="Committed value" value={formatCurrency(committedValue)} tone="good" />
        </section>
        {project.bidPackages.map((pkg) => {
          const low = Math.min(...pkg.subBids.filter((b) => b.bidAmount).map((b) => b.bidAmount!));
          return (
            <section key={pkg.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">{pkg.trade}</div>
                  <Link href={`/projects/${project.id}/bids/${pkg.id}`} className="mt-1 block text-lg font-semibold text-white hover:text-cyan-200 hover:underline">{pkg.name}</Link>
                  <div className="text-xs text-slate-500">Due: {formatDate(pkg.dueDate)} · Est. value: {formatCurrency(pkg.estimatedValue)}</div>
                  {pkg.scopeSummary ? <div className="mt-2 text-sm text-slate-300">{pkg.scopeSummary}</div> : null}
                </div>
                <StatusBadge status={pkg.status} />
              </div>
              <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
                <table className="min-w-full divide-y divide-white/10">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="table-header">Vendor</th>
                      <th className="table-header">Amount</th>
                      <th className="table-header">Δ vs. low</th>
                      <th className="table-header">Duration</th>
                      <th className="table-header">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 bg-slate-950/40">
                    {pkg.subBids.map((b) => {
                      const delta = b.bidAmount && isFinite(low) ? b.bidAmount - low : null;
                      return (
                        <tr key={b.id} className="cursor-pointer transition hover:bg-white/5">
                          <td className="table-cell">
                            <Link href={`/vendors/${b.vendor.id}`} className="text-cyan-300 hover:text-cyan-200 hover:underline">
                              <div className="font-medium">{b.vendor.name}</div>
                              <div className="text-xs text-slate-500">{b.vendor.trade ?? "—"}</div>
                            </Link>
                          </td>
                          <td className="table-cell">{b.bidAmount ? formatCurrency(b.bidAmount) : "—"}</td>
                          <td className="table-cell">{delta == null ? "—" : delta === 0 ? <span className="text-emerald-300">Low bid</span> : `+${formatCurrency(delta)}`}</td>
                          <td className="table-cell text-slate-400">{b.daysToComplete ? `${b.daysToComplete}d` : "—"}</td>
                          <td className="table-cell"><StatusBadge status={b.status} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
        {project.bidPackages.length === 0 ? <div className="card p-8 text-center text-slate-500">No bid packages yet.</div> : null}
      </div>
    </AppLayout>
  );
}
