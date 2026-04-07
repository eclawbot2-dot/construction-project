import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { getDashboardData } from "@/lib/dashboard";
import { formatCurrency, formatPercent, modeLabel, roleLabel } from "@/lib/utils";

export default async function Home() {
  const data = await getDashboardData();

  if (!data) {
    return (
      <AppLayout title="Construction OS" eyebrow="Platform" description="No seeded tenant found.">
        <div className="card p-8">Run the setup script to seed demo data.</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      eyebrow="Enterprise operating system"
      title={data.tenant.name}
      description="One codebase supporting simple contractors, vertical building teams, and heavy civil operations with shared identity, finance, workflow, and audit layers."
    >
      <div className="grid gap-6">
        <section className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
          <div className="card p-6">
            <div className="text-xs uppercase tracking-[0.24em] text-cyan-300">Tenant controls</div>
            <div className="mt-4 grid gap-4 md:grid-cols-4">
              <div className="panel p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Projects</div>
                <div className="mt-2 text-3xl font-semibold text-white">{data.kpis.projects}</div>
              </div>
              <div className="panel p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Open tasks</div>
                <div className="mt-2 text-3xl font-semibold text-white">{data.kpis.openTasks}</div>
              </div>
              <div className="panel p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-400">RFIs</div>
                <div className="mt-2 text-3xl font-semibold text-white">{data.kpis.activeRfis}</div>
              </div>
              <div className="panel p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Tickets</div>
                <div className="mt-2 text-3xl font-semibold text-white">{data.kpis.tickets}</div>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="badge-blue">Primary: {modeLabel(data.tenant.primaryMode)}</span>
              {data.tenant.enabledModes.map((mode) => <span key={mode} className="badge-gray">{modeLabel(mode)}</span>)}
              {data.tenant.featurePacks.map((pack) => <span key={pack} className="badge-gold">{pack}</span>)}
            </div>
          </div>

          <div className="card p-6">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Business units and role mix</div>
            <div className="mt-4 space-y-3">
              {data.tenant.businessUnits.map((unit) => (
                <div key={unit.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="font-medium text-white">{unit.name}</div>
                  <div className="mt-1 text-xs text-slate-500">{modeLabel(unit.defaultMode)} · {unit.region}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {Object.entries(data.sharedServices.workforce.byRole).map(([role, count]) => (
                <span key={role} className="badge-gray">{roleLabel(role)}: {count}</span>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {data.projectsByMode.map((group) => (
            <div key={group.mode} className="card p-5">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{modeLabel(group.mode)}</div>
              <div className="mt-3 text-3xl font-semibold text-white">{group.count}</div>
              <div className="mt-3 flex items-center justify-between text-sm text-slate-400">
                <span>Avg health</span>
                <span>{group.avgHealth}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm text-slate-400">
                <span>Avg progress</span>
                <span>{group.progressAvg}%</span>
              </div>
            </div>
          ))}
        </section>

        <section className="grid gap-5">
          {data.projectWorkspaces.map((project) => (
            <article key={project.id} className="card p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">{modeLabel(project.mode)}</div>
                  <h2 className="mt-1 text-2xl font-semibold text-white">{project.name}</h2>
                  <div className="mt-2 text-sm text-slate-400">{project.code} · {project.ownerName} · {project.contractType}</div>
                  <div className="mt-3 text-sm leading-6 text-slate-300">{project.latestSummary}</div>
                </div>
                <div className="grid grid-cols-2 gap-3 lg:min-w-[280px]">
                  <div className="panel p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Value</div>
                    <div className="mt-2 text-xl font-semibold text-white">{formatCurrency(project.contractValue)}</div>
                  </div>
                  <div className="panel p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Progress</div>
                    <div className="mt-2 text-xl font-semibold text-white">{formatPercent(project.progressPct)}</div>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {project.metrics.map((metric) => (
                  <span key={metric.label} className="badge-gray">{metric.label}: {metric.value}</span>
                ))}
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
                <div className="panel p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Workspace tabs</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {project.tabs.map((tab) => <span key={tab} className="badge-blue">{tab}</span>)}
                  </div>
                </div>
                <div className="panel p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Recent engagement</div>
                  <div className="mt-3 space-y-2 text-sm text-slate-300">
                    {project.recentMessages.slice(0, 2).map((message) => (
                      <div key={message.id} className="rounded-xl border border-white/5 bg-white/5 p-3">{message.body}</div>
                    ))}
                  </div>
                </div>
                <div className="flex items-end">
                  <Link href={`/projects/${project.id}`} className="btn-primary">Open project</Link>
                </div>
              </div>
            </article>
          ))}
        </section>
      </div>
    </AppLayout>
  );
}
