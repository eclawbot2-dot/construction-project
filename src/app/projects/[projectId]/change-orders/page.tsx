import Link from "next/link";
import { notFound } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { ProjectTabs } from "@/components/layout/project-tabs";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { changeOrderKindLabel, formatCurrency, formatDate } from "@/lib/utils";
import { sumMoney } from "@/lib/money";

export default async function ChangeOrdersPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const tenant = await requireTenant();
  const project = await prisma.project.findFirst({
    where: { id: projectId, tenantId: tenant.id },
    include: { changeOrders: { orderBy: { coNumber: "asc" }, include: { lines: true } } },
  });
  if (!project) notFound();

  const approvedTotal = sumMoney(project.changeOrders.filter((c) => c.status === "APPROVED" || c.status === "EXECUTED").map((c) => c.amount));
  const pendingTotal = sumMoney(project.changeOrders.filter((c) => c.status === "PENDING" || c.status === "DRAFT").map((c) => c.amount));
  const scheduleImpact = project.changeOrders.reduce((s, c) => s + c.scheduleImpactDays, 0);

  return (
    <AppLayout eyebrow={`${project.code} · Change orders`} title={project.name} description="Formal change management with approval workflows and cost + schedule impact.">
      <div className="grid gap-6">
        <ProjectTabs projectId={project.id} active="change-orders" mode={project.mode} />

        <section className="grid gap-4 md:grid-cols-4">
          <Stat label="Total change orders" value={project.changeOrders.length} />
          <Stat label="Approved value" value={formatCurrency(approvedTotal)} tone="good" />
          <Stat label="Pending value" value={formatCurrency(pendingTotal)} tone="warn" />
          <Stat label="Schedule impact" value={`${scheduleImpact}d`} />
        </section>

        <section className="card p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <div className="text-sm font-semibold text-white">Change order log</div>
              <div className="text-xs text-slate-400">Click any change order to see its breakdown.</div>
            </div>
            <Link href={`/projects/${project.id}`} className="btn-outline text-xs">← Back to project</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-white/5">
                <tr>
                  <th className="table-header">#</th>
                  <th className="table-header">Kind</th>
                  <th className="table-header">Title</th>
                  <th className="table-header">Amount</th>
                  <th className="table-header">Sched. impact</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Requested</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-slate-950/40">
                {project.changeOrders.map((co) => (
                  <tr key={co.id} className="cursor-pointer transition hover:bg-white/5">
                    <td className="table-cell font-mono text-xs text-slate-400">{co.coNumber}</td>
                    <td className="table-cell">{changeOrderKindLabel(co.kind)}</td>
                    <td className="table-cell">
                      <Link href={`/projects/${project.id}/change-orders/${co.id}`} className="text-cyan-300 hover:text-cyan-200 hover:underline">
                        <div className="font-medium">{co.title}</div>
                        {co.description ? <div className="text-xs text-slate-500">{co.description}</div> : null}
                      </Link>
                    </td>
                    <td className="table-cell font-medium text-white">{formatCurrency(co.amount)}</td>
                    <td className="table-cell">{co.scheduleImpactDays ? `${co.scheduleImpactDays}d` : "—"}</td>
                    <td className="table-cell"><StatusBadge status={co.status} /></td>
                    <td className="table-cell text-slate-400">{formatDate(co.requestedAt)}</td>
                  </tr>
                ))}
                {project.changeOrders.length === 0 ? (
                  <tr><td colSpan={7} className="table-cell text-center text-slate-500">No change orders yet.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
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
