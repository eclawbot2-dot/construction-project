import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { StatTile } from "@/components/ui/stat-tile";
import { getDashboardData } from "@/lib/dashboard";
import { formatCurrency, formatPercent, modeLabel, roleLabel } from "@/lib/utils";

export default async function Home() {
  const data = await getDashboardData();

  if (!data) {
    return (
      <AppLayout title="Construction OS" eyebrow="Platform" description="No tenant context for this user.">
        <div className="card p-8">
          <h2 className="text-lg font-semibold" style={{ color: "var(--heading)" }}>Welcome.</h2>
          <p className="mt-2 text-sm" style={{ color: "var(--faint)" }}>
            Your account isn't linked to a tenant yet. Ask your administrator to add you to a tenant, or contact the platform operator.
          </p>
        </div>
      </AppLayout>
    );
  }

  if (data.kpis.projects === 0) {
    return (
      <AppLayout
        eyebrow="Welcome"
        title={data.tenant.name}
        description="Your tenant is set up. Start by creating your first project — every other workflow flows from there."
      >
        <div className="card p-8 text-center">
          <h2 className="text-lg font-semibold" style={{ color: "var(--heading)" }}>No projects yet</h2>
          <p className="mt-2 max-w-md mx-auto text-sm" style={{ color: "var(--faint)" }}>
            Projects are the unit of work in Construction OS. Once you create one, you'll get RFIs, submittals, daily logs, change orders, and the full mode-aware workspace.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/admin/tenants" className="btn-outline">Tenant admin</Link>
            <Link href="/projects" className="btn-primary">Open projects</Link>
          </div>
        </div>
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
        <section className="card p-6 border-cyan-500/30 bg-gradient-to-br from-cyan-950/50 to-slate-950">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-cyan-300">AI assistant</div>
              <div className="mt-2 text-lg font-semibold text-white">Ask anything about your business</div>
              <p className="mt-1 text-sm text-slate-300">Pipeline by mode · Projects over budget · Top vendors · 45+ AI helpers across bids, finance, risk, ops.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/assistant" className="btn-primary text-xs">Open assistant →</Link>
              <Link href="/finance/ai" className="btn-outline text-xs">Finance AI</Link>
              <Link href="/risk" className="btn-outline text-xs">Risk AI</Link>
              <Link href="/operations/ai" className="btn-outline text-xs">Ops AI</Link>
              <Link href="/ai/meta" className="btn-outline text-xs">LLM status</Link>
            </div>
          </div>
        </section>
        <section className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
          <div className="card p-6">
            <div className="text-xs uppercase tracking-[0.24em] text-cyan-300">Tenant controls</div>
            <div className="mt-4 grid gap-4 md:grid-cols-4">
              <StatTile label="Projects" value={data.kpis.projects} href="/projects" />
              <StatTile label="Open tasks" value={data.kpis.openTasks} href="/projects" />
              <StatTile label="RFIs" value={data.kpis.activeRfis} href="/projects" />
              <StatTile label="Tickets" value={data.kpis.tickets} href="/operations" />
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
            <Link key={group.mode} href="/projects" className="card p-5 transition hover:border-cyan-500/40">
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
              <div className="mt-3 text-[10px] uppercase tracking-[0.22em] text-cyan-300">View projects →</div>
            </Link>
          ))}
        </section>

        <section className="grid gap-5">
          {data.projectWorkspaces.map((project) => (
            <article key={project.id} className="card p-6 transition hover:border-cyan-500/40">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">{modeLabel(project.mode)}</div>
                  <Link href={`/projects/${project.id}`} className="mt-1 block text-2xl font-semibold text-white hover:text-cyan-200">{project.name}</Link>
                  <div className="mt-2 text-sm text-slate-400">{project.code} · {project.ownerName} · {project.contractType}</div>
                  <div className="mt-3 text-sm leading-6 text-slate-300">{project.latestSummary}</div>
                </div>
                <div className="grid grid-cols-2 gap-3 lg:min-w-[280px]">
                  <StatTile label="Value" value={formatCurrency(project.contractValue)} href={`/projects/${project.id}/contracts`} />
                  <StatTile label="Progress" value={formatPercent(project.progressPct)} href={`/projects/${project.id}/schedule`} />
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
