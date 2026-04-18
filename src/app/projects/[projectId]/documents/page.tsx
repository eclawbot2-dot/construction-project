import { notFound } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { ProjectTabs } from "@/components/layout/project-tabs";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { formatDate } from "@/lib/utils";

export default async function ProjectDocumentsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const tenant = await requireTenant();
  const project = await prisma.project.findFirst({
    where: { id: projectId, tenantId: tenant.id },
    include: { documents: { orderBy: { createdAt: "desc" } } },
  });
  if (!project) notFound();

  const byClass = project.documents.reduce<Record<string, number>>((acc, d) => { acc[d.documentClass] = (acc[d.documentClass] ?? 0) + 1; return acc; }, {});

  return (
    <AppLayout eyebrow={`${project.code} · Documents`} title={project.name} description="Drawings, specs, permits, contracts, photos — organized by class and folder.">
      <div className="grid gap-6">
        <ProjectTabs projectId={project.id} active="documents" />
        <section className="grid gap-3 md:grid-cols-4 lg:grid-cols-6">
          {Object.entries(byClass).map(([cls, count]) => (
            <div key={cls} className="panel p-4">
              <div className="text-[10px] uppercase tracking-[0.16em] text-slate-400">{cls}</div>
              <div className="mt-2 text-xl font-semibold text-white">{count}</div>
            </div>
          ))}
        </section>
        <section className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-white/5">
                <tr>
                  <th className="table-header">Title</th>
                  <th className="table-header">Class</th>
                  <th className="table-header">Folder</th>
                  <th className="table-header">Version</th>
                  <th className="table-header">Uploaded</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-slate-950/40">
                {project.documents.map((d) => (
                  <tr key={d.id}>
                    <td className="table-cell">{d.title}</td>
                    <td className="table-cell text-slate-400">{d.documentClass}</td>
                    <td className="table-cell text-slate-400">{d.folderPath ?? "—"}</td>
                    <td className="table-cell">{d.versionLabel}</td>
                    <td className="table-cell text-slate-400">{formatDate(d.createdAt)}</td>
                  </tr>
                ))}
                {project.documents.length === 0 ? <tr><td colSpan={5} className="table-cell text-center text-slate-500">No documents uploaded.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
