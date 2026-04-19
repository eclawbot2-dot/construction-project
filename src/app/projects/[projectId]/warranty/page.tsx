import { notFound } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { ProjectTabs } from "@/components/layout/project-tabs";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatTile } from "@/components/ui/stat-tile";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { formatDate } from "@/lib/utils";

export default async function WarrantyPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const tenant = await requireTenant();
  const project = await prisma.project.findFirst({
    where: { id: projectId, tenantId: tenant.id },
    include: { warrantyItems: { orderBy: { reportedAt: "desc" } } },
  });
  if (!project) notFound();

  const open = project.warrantyItems.filter((w) => w.status === "OPEN" || w.status === "IN_PROGRESS").length;
  const resolved = project.warrantyItems.filter((w) => w.status === "RESOLVED").length;
  const avgResolveDays = (() => {
    const resolved = project.warrantyItems.filter((w) => w.resolvedAt);
    if (resolved.length === 0) return "—";
    const total = resolved.reduce((s, w) => s + (new Date(w.resolvedAt!).getTime() - new Date(w.reportedAt).getTime()) / (1000 * 60 * 60 * 24), 0);
    return `${Math.round(total / resolved.length)}d`;
  })();

  return (
    <AppLayout eyebrow={`${project.code} · Warranty`} title={project.name} description="Post-occupancy issues, who reported, who owns, and resolution tracking.">
      <div className="grid gap-6">
        <ProjectTabs projectId={project.id} active="warranty" mode={project.mode} />
        <section className="grid gap-4 md:grid-cols-4">
          <StatTile label="Items on file" value={project.warrantyItems.length} />
          <StatTile label="Open" value={open} tone="warn" />
          <StatTile label="Resolved" value={resolved} tone="good" />
          <StatTile label="Avg resolution" value={avgResolveDays} />
        </section>
        <section className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-white/5">
                <tr>
                  <th className="table-header">Title</th>
                  <th className="table-header">Reported by</th>
                  <th className="table-header">Assigned to</th>
                  <th className="table-header">Severity</th>
                  <th className="table-header">Reported</th>
                  <th className="table-header">Resolved</th>
                  <th className="table-header">Expires</th>
                  <th className="table-header">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-slate-950/40">
                {project.warrantyItems.map((w) => (
                  <tr key={w.id}>
                    <td className="table-cell">
                      <div className="font-medium text-white">{w.title}</div>
                      {w.description ? <div className="text-xs text-slate-500">{w.description}</div> : null}
                    </td>
                    <td className="table-cell text-slate-400">{w.reportedBy ?? "—"}</td>
                    <td className="table-cell text-slate-400">{w.assignedTo ?? "—"}</td>
                    <td className="table-cell">{w.severity}</td>
                    <td className="table-cell text-slate-400">{formatDate(w.reportedAt)}</td>
                    <td className="table-cell text-slate-400">{formatDate(w.resolvedAt)}</td>
                    <td className="table-cell text-slate-400">{formatDate(w.warrantyExpires)}</td>
                    <td className="table-cell"><StatusBadge status={w.status} /></td>
                  </tr>
                ))}
                {project.warrantyItems.length === 0 ? <tr><td colSpan={8} className="table-cell text-center text-slate-500">No warranty items.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
