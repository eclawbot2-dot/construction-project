import { notFound } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { ProjectTabs } from "@/components/layout/project-tabs";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { formatCurrency, formatDate, lienWaiverTypeLabel } from "@/lib/utils";

export default async function LienWaiversPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const tenant = await requireTenant();
  const project = await prisma.project.findFirst({
    where: { id: projectId, tenantId: tenant.id },
    include: { lienWaivers: { include: { contract: true }, orderBy: { createdAt: "desc" } } },
  });
  if (!project) notFound();

  const received = project.lienWaivers.filter((w) => w.status === "RECEIVED").length;
  const pending = project.lienWaivers.filter((w) => w.status === "PENDING").length;
  const receivedAmount = project.lienWaivers.filter((w) => w.status === "RECEIVED").reduce((s, w) => s + w.amount, 0);
  const pendingAmount = project.lienWaivers.filter((w) => w.status === "PENDING").reduce((s, w) => s + w.amount, 0);

  return (
    <AppLayout eyebrow={`${project.code} · Lien waivers`} title={project.name} description="Conditional and unconditional waivers by party, tied to pay applications.">
      <div className="grid gap-6">
        <ProjectTabs projectId={project.id} active="lien-waivers" mode={project.mode} />

        <section className="grid gap-4 md:grid-cols-4">
          <Stat label="Waivers on file" value={project.lienWaivers.length} />
          <Stat label="Received" value={received} tone="good" />
          <Stat label="Pending" value={pending} tone="warn" />
          <Stat label="Pending $" value={formatCurrency(pendingAmount)} tone="warn" />
        </section>

        <section className="card p-0 overflow-hidden">
          <div className="px-5 py-3 text-xs uppercase tracking-[0.2em] text-slate-400">
            Waiver log · {formatCurrency(receivedAmount)} received, {formatCurrency(pendingAmount)} outstanding
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-white/5">
                <tr>
                  <th className="table-header">Party</th>
                  <th className="table-header">Type</th>
                  <th className="table-header">Through</th>
                  <th className="table-header">Amount</th>
                  <th className="table-header">Contract</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-slate-950/40">
                {project.lienWaivers.map((w) => (
                  <tr key={w.id}>
                    <td className="table-cell">
                      <div className="font-medium text-white">{w.partyName}</div>
                      {w.notes ? <div className="text-xs text-slate-500">{w.notes}</div> : null}
                    </td>
                    <td className="table-cell">{lienWaiverTypeLabel(w.waiverType)}</td>
                    <td className="table-cell text-slate-400">{formatDate(w.throughDate)}</td>
                    <td className="table-cell">{formatCurrency(w.amount)}</td>
                    <td className="table-cell text-xs text-slate-400">{w.contract?.contractNumber ?? "—"}</td>
                    <td className="table-cell"><StatusBadge status={w.status} /></td>
                    <td className="table-cell text-slate-400">{formatDate(w.receivedAt)}</td>
                  </tr>
                ))}
                {project.lienWaivers.length === 0 ? (
                  <tr><td colSpan={7} className="table-cell text-center text-slate-500">No lien waivers tracked.</td></tr>
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
