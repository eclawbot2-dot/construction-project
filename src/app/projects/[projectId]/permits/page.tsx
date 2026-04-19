import { notFound } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { ProjectTabs } from "@/components/layout/project-tabs";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { formatDate } from "@/lib/utils";

export default async function PermitsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const tenant = await requireTenant();
  const project = await prisma.project.findFirst({
    where: { id: projectId, tenantId: tenant.id },
    include: {
      permits: {
        include: { inspections: { orderBy: { scheduledAt: "desc" } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!project) notFound();

  const active = project.permits.filter((p) => p.status === "ISSUED" || p.status === "UNDER_REVIEW").length;
  const expiring = project.permits.filter((p) => p.expiresAt && new Date(p.expiresAt).getTime() - Date.now() < 60 * 24 * 3600 * 1000 && p.status === "ISSUED").length;
  const totalInspections = project.permits.reduce((s, p) => s + p.inspections.length, 0);
  const failed = project.permits.reduce((s, p) => s + p.inspections.filter((i) => i.result === "FAIL").length, 0);

  return (
    <AppLayout eyebrow={`${project.code} · Permits`} title={project.name} description="Permit applications, issued permits, jurisdiction inspection lookup, and compliance aging.">
      <div className="grid gap-6">
        <ProjectTabs projectId={project.id} active="permits" mode={project.mode} />
        <section className="grid gap-4 md:grid-cols-4">
          <StatTile label="Permits on file" value={project.permits.length} />
          <StatTile label="Active / in review" value={active} />
          <StatTile label="Expiring (60d)" value={expiring} tone={expiring > 0 ? "warn" : "good"} />
          <StatTile label="Inspection failures" value={failed} tone={failed > 0 ? "bad" : "good"} sub={`${totalInspections} total inspections`} />
        </section>

        {project.permits.map((p) => (
          <section key={p.id} className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">{p.permitType}</div>
                <div className="mt-1 text-lg font-semibold text-white">{p.permitNumber}</div>
                <div className="text-xs text-slate-500">{p.jurisdiction} · {p.scopeDescription ?? "—"}</div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <StatusBadge status={p.status} />
                <form action={`/api/permits/${p.id}/lookup`} method="post">
                  <button type="submit" className="btn-outline text-xs" disabled={!p.autoLookupEnabled}>
                    {p.autoLookupEnabled ? "Sync inspections" : "Enable auto-lookup"}
                  </button>
                </form>
                {p.lastLookupAt ? (
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                    Last sync: {formatDate(p.lastLookupAt)} · {p.lastLookupStatus}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="panel p-3"><div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Applied</div><div className="mt-1 text-sm text-white">{formatDate(p.appliedAt)}</div></div>
              <div className="panel p-3"><div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Issued</div><div className="mt-1 text-sm text-white">{formatDate(p.issuedAt)}</div></div>
              <div className="panel p-3"><div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Expires</div><div className="mt-1 text-sm text-white">{formatDate(p.expiresAt)}</div></div>
              <div className="panel p-3"><div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Finaled</div><div className="mt-1 text-sm text-white">{formatDate(p.finaledAt)}</div></div>
            </div>
            {p.inspections.length > 0 ? (
              <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
                <table className="min-w-full divide-y divide-white/10">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="table-header">Kind</th>
                      <th className="table-header">Title</th>
                      <th className="table-header">Inspector</th>
                      <th className="table-header">Scheduled</th>
                      <th className="table-header">Completed</th>
                      <th className="table-header">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 bg-slate-950/40">
                    {p.inspections.map((insp) => (
                      <tr key={insp.id}>
                        <td className="table-cell">{insp.kind.replaceAll("_", " ")}</td>
                        <td className="table-cell">{insp.title}</td>
                        <td className="table-cell text-slate-400">{insp.inspector ?? "—"}</td>
                        <td className="table-cell text-slate-400">{formatDate(insp.scheduledAt)}</td>
                        <td className="table-cell text-slate-400">{formatDate(insp.completedAt)}</td>
                        <td className="table-cell"><StatusBadge status={insp.result} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-center text-sm text-slate-500">
                No inspections synced yet. {p.autoLookupEnabled ? "Click Sync inspections above." : "Enable auto-lookup to pull inspections from the jurisdiction."}
              </div>
            )}
          </section>
        ))}
        {project.permits.length === 0 ? <div className="card p-8 text-center text-slate-500">No permits on file.</div> : null}
      </div>
    </AppLayout>
  );
}
