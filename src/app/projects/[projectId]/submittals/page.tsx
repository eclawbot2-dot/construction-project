import Link from "next/link";
import { notFound } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { ProjectTabs } from "@/components/layout/project-tabs";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";

export default async function SubmittalsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const tenant = await requireTenant();
  const project = await prisma.project.findFirst({
    where: { id: projectId, tenantId: tenant.id },
    include: { submittals: { orderBy: { createdAt: "desc" } } },
  });
  if (!project) notFound();

  const longLead = project.submittals.filter((s) => s.longLead).length;
  const approved = project.submittals.filter((s) => s.status === "APPROVED").length;

  return (
    <AppLayout eyebrow={`${project.code} · Submittals`} title={project.name} description="Shop drawings and material approvals routed by spec section.">
      <div className="grid gap-6">
        <ProjectTabs projectId={project.id} active="submittals" mode={project.mode} />
        <section className="grid gap-4 md:grid-cols-3">
          <Stat label="Total submittals" value={project.submittals.length} />
          <Stat label="Long-lead items" value={longLead} tone="warn" />
          <Stat label="Approved" value={approved} tone="good" />
        </section>
        <section className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-white/5">
                <tr>
                  <th className="table-header">#</th>
                  <th className="table-header">Title</th>
                  <th className="table-header">Spec section</th>
                  <th className="table-header">Long-lead</th>
                  <th className="table-header">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-slate-950/40">
                {project.submittals.map((s) => (
                  <tr key={s.id} className="cursor-pointer transition hover:bg-white/5">
                    <td className="table-cell font-mono text-xs text-slate-400">{s.number}</td>
                    <td className="table-cell"><Link href={`/projects/${project.id}/submittals/${s.id}`} className="text-cyan-300 hover:text-cyan-200 hover:underline">{s.title}</Link></td>
                    <td className="table-cell text-slate-400">{s.specSection ?? "—"}</td>
                    <td className="table-cell">{s.longLead ? <StatusBadge tone="warn" label="Long lead" /> : "—"}</td>
                    <td className="table-cell"><StatusBadge status={s.status} /></td>
                  </tr>
                ))}
                {project.submittals.length === 0 ? <tr><td colSpan={5} className="table-cell text-center text-slate-500">No submittals on file.</td></tr> : null}
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
