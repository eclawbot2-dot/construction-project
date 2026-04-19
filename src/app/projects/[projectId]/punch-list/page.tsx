import Link from "next/link";
import { notFound } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { ProjectTabs } from "@/components/layout/project-tabs";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { formatDate } from "@/lib/utils";

export default async function PunchListPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const tenant = await requireTenant();
  const project = await prisma.project.findFirst({
    where: { id: projectId, tenantId: tenant.id },
    include: { punchItems: { orderBy: { createdAt: "desc" } } },
  });
  if (!project) notFound();

  const open = project.punchItems.filter((p) => p.status !== "CLOSED" && p.status !== "APPROVED").length;

  return (
    <AppLayout eyebrow={`${project.code} · Punch list`} title={project.name} description="Pre-completion deficiency tracking by area.">
      <div className="grid gap-6">
        <ProjectTabs projectId={project.id} active="punch-list" mode={project.mode} />
        <section className="grid gap-4 md:grid-cols-3">
          <Stat label="Total items" value={project.punchItems.length} />
          <Stat label="Open" value={open} tone="warn" />
          <Stat label="Closed" value={project.punchItems.length - open} tone="good" />
        </section>
        <section className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-white/5">
                <tr>
                  <th className="table-header">Title</th>
                  <th className="table-header">Area</th>
                  <th className="table-header">Due</th>
                  <th className="table-header">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-slate-950/40">
                {project.punchItems.map((p) => (
                  <tr key={p.id} className="cursor-pointer transition hover:bg-white/5">
                    <td className="table-cell"><Link href={`/projects/${project.id}/punch-list/${p.id}`} className="text-cyan-300 hover:text-cyan-200 hover:underline">{p.title}</Link></td>
                    <td className="table-cell text-slate-400">{p.area ?? "—"}</td>
                    <td className="table-cell text-slate-400">{formatDate(p.dueDate)}</td>
                    <td className="table-cell"><StatusBadge status={p.status} /></td>
                  </tr>
                ))}
                {project.punchItems.length === 0 ? <tr><td colSpan={4} className="table-cell text-center text-slate-500">No punch items recorded.</td></tr> : null}
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
  return <div className="panel p-4"><div className="text-xs uppercase tracking-[0.16em] text-slate-400">{label}</div><div className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</div></div>;
}
