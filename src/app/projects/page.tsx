import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { getDashboardData } from "@/lib/dashboard";
import { formatCurrency, formatPercent, modeLabel } from "@/lib/utils";

export default async function ProjectsPage() {
  const data = await getDashboardData();

  return (
    <AppLayout
      eyebrow="Pass 2 — Project workspace"
      title="Projects"
      description="Mode-aware project registry with one workspace model that shifts behavior for simple builders, vertical teams, and heavy civil operations."
    >
      <div className="grid gap-5">
        {data?.projectWorkspaces.map((project) => (
          <section key={project.id} className="card p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">{modeLabel(project.mode)}</div>
                <h2 className="mt-1 text-2xl font-semibold text-white">{project.name}</h2>
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
                    <div key={task.id} className="rounded-xl border border-white/5 bg-white/5 p-3">
                      <div className="font-medium text-white">{task.title}</div>
                      <div className="mt-1 text-xs text-slate-400">{task.priority} · {task.status.replaceAll("_", " ")}</div>
                    </div>
                  ))}
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
