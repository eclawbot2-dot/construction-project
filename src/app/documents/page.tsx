import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";

export default async function DocumentsRollupPage() {
  const docs = await prisma.document.findMany({
    include: { project: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const byClass = docs.reduce<Record<string, number>>((acc, d) => { acc[d.documentClass] = (acc[d.documentClass] ?? 0) + 1; return acc; }, {});
  return (
    <AppLayout eyebrow="Document control" title="Documents" description="All drawings, specs, permits, contracts, and field records across every project.">
      <div className="grid gap-6">
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
                  <th className="table-header">Document</th>
                  <th className="table-header">Class</th>
                  <th className="table-header">Project</th>
                  <th className="table-header">Folder</th>
                  <th className="table-header">Version</th>
                  <th className="table-header">Uploaded</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-slate-950/40">
                {docs.map((d) => (
                  <tr key={d.id} className="transition hover:bg-white/5">
                    <td className="table-cell font-medium text-white">{d.title}</td>
                    <td className="table-cell text-slate-400">{d.documentClass}</td>
                    <td className="table-cell"><Link href={`/projects/${d.project.id}/documents`} className="text-cyan-300 hover:underline">{d.project.code}</Link></td>
                    <td className="table-cell text-slate-400">{d.folderPath ?? "—"}</td>
                    <td className="table-cell">{d.versionLabel}</td>
                    <td className="table-cell text-slate-400">{formatDate(d.createdAt)}</td>
                  </tr>
                ))}
                {docs.length === 0 ? <tr><td colSpan={6} className="table-cell text-center text-slate-500">No documents in the system yet.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
