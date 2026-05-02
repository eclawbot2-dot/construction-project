import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { getDashboardData } from "@/lib/dashboard";
import { formatCurrency, formatPercent, modeLabel, modeColor, modeShort } from "@/lib/utils";

export default async function ProjectsPage() {
  const data = await getDashboardData();

  return (
    <AppLayout
      eyebrow="Project workspace"
      title="Projects"
      description="Mode-aware project registry with one workspace model that shifts behavior for simple builders, vertical teams, and heavy civil operations."
    >
      <div className="grid gap-5">
        <div className="flex items-center justify-between">
          <div className="text-sm" style={{ color: "var(--faint)" }}>
            {data?.projectWorkspaces.length ?? 0} project{data?.projectWorkspaces.length === 1 ? "" : "s"} in this tenant
          </div>
          <Link href="/projects/create" className="btn-primary">+ New project</Link>
        </div>
        {data?.projectWorkspaces.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-sm" style={{ color: "var(--faint)" }}>No projects yet.</p>
            <Link href="/projects/create" className="btn-primary mt-4 inline-block">Create your first project</Link>
          </div>
        ) : null}
        {data?.projectWorkspaces.map((project) => (
          <section key={project.id} className="card p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className={`inline-flex items-center gap-2 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] ${modeColor(project.mode, "border")} ${modeColor(project.mode, "bg")} ${modeColor(project.mode, "text")}`}>
                  <span>{modeShort(project.mode)}</span>
                  <span className="opacity-70">{modeLabel(project.mode)}</span>
                </div>
                <h2 className="mt-2 text-2xl font-semibold text-white">{project.name}</h2>
                <div className="mt-2 text-sm text-slate-400">{project.code} · {project.contractType} · {project.address}</div>
                <div className="mt-2 text-sm text-slate-400">Owner: {project.ownerName}</div>
              </div>
              <div className="grid grid-cols-2 gap-3 lg:min-w-[280px]">
                <div className="panel p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Contract value</div>
                  <div className="mt-2 text-xl font-semibold text-white">{formatCurrency(project.contractValue)}</div>
                </div>
                <div className="panel p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Progress</div>
                  <div className="mt-2 text-xl font-semibold text-white">{formatPercent(project.progressPct)}</div>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {project.tabs.map((tab) => (
                <span key={tab} className="badge-blue">{tab}</span>
              ))}
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              <div className="panel p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Upcoming tasks</div>
                <div className="mt-3 space-y-3">
                  {project.upcomingTasks.map((task) => (
                    <Link key={task.id} href={`/projects/${project.id}/tasks`} className="block rounded-xl border border-white/5 bg-white/5 p-3 transition hover:border-cyan-500/40 hover:bg-white/10">
                      <div className="font-medium text-white">{task.title}</div>
                      <div className="mt-1 text-xs text-slate-400">{task.priority} · {task.status.replaceAll("_", " ")}</div>
                    </Link>
                  ))}
                  {project.upcomingTasks.length === 0 ? <div className="text-xs text-slate-500">No upcoming tasks.</div> : null}
                </div>
              </div>
              <div className="panel p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Workflow channels</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {project.channels.map((channel) => (
                    <span key={`${project.id}-${channel.channel}`} className="badge-gray">{channel.channel}</span>
                  ))}
                </div>
                <div className="mt-4 text-sm leading-6 text-slate-300">{project.latestSummary}</div>
              </div>
              <div className="panel p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Workspace link</div>
                <div className="mt-3 text-sm text-slate-300">Open the full project workspace with mode-specific tabs and engagement surfaces.</div>
                <Link href={`/projects/${project.id}`} className="btn-primary mt-4">Open workspace</Link>
              </div>
            </div>
          </section>
        ))}
      </div>
    </AppLayout>
  );
}
