import { getDashboardData } from "@/lib/dashboard";
import { Building2, ClipboardCheck, HardHat, ShieldCheck, Truck, Users } from "lucide-react";

function modeLabel(mode: string) {
  if (mode === "SIMPLE") return "Simple Construction PM";
  if (mode === "VERTICAL") return "Vertical Building";
  if (mode === "HEAVY_CIVIL") return "Heavy Civil";
  return mode;
}

function MetricPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
      <span className="text-slate-400">{label}</span>
      <span className="ml-2 font-semibold text-white">{value}</span>
    </div>
  );
}

export default async function Home() {
  const data = await getDashboardData();

  if (!data) {
    return <main className="p-10 text-white">No seeded tenant found. Run the setup script.</main>;
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-8 lg:px-10">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 p-8 shadow-2xl shadow-slate-950/40">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
                Multi-tenant construction operating system
              </div>
              <div>
                <h1 className="text-4xl font-semibold tracking-tight text-white lg:text-5xl">{data.tenant.name}</h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 lg:text-base">
                  One codebase running three operating modes with shared identity, RBAC, finance, auditability, and workflow services.
                  Tenant defaults drive terminology, dashboards, forms, and module behavior by business unit and project.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <MetricPill label="Primary mode" value={modeLabel(data.tenant.primaryMode)} />
                <MetricPill label="Enabled modes" value={data.tenant.enabledModes.length} />
                <MetricPill label="Feature packs" value={data.tenant.featurePacks.length} />
                <MetricPill label="Business units" value={data.tenant.businessUnits.length} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              {[
                { icon: Building2, label: "Projects", value: data.kpis.projects },
                { icon: ClipboardCheck, label: "Open tasks", value: data.kpis.openTasks },
                { icon: ShieldCheck, label: "Active RFIs", value: data.kpis.activeRfis },
                { icon: HardHat, label: "Submittals", value: data.kpis.activeSubmittals },
                { icon: Truck, label: "Tickets", value: data.kpis.tickets },
                { icon: Users, label: "Documents", value: data.kpis.documents },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <item.icon className="mb-3 h-5 w-5 text-cyan-300" />
                  <div className="text-2xl font-semibold text-white">{item.value}</div>
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {data.projectsByMode.map((group) => (
            <div key={group.mode} className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{modeLabel(group.mode)}</div>
              <div className="mt-2 text-3xl font-semibold">{group.count}</div>
              <div className="mt-4 flex items-center justify-between text-sm text-slate-300">
                <span>Avg health</span>
                <span>{group.avgHealth}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm text-slate-300">
                <span>Avg progress</span>
                <span>{group.progressAvg}%</span>
              </div>
            </div>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[2fr_1fr]">
          <div className="space-y-6">
            {data.dashboardCards.map((project) => (
              <article key={project.id} className="rounded-3xl border border-white/10 bg-slate-900/80 p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">{modeLabel(project.mode)}</div>
                    <h2 className="mt-1 text-2xl font-semibold text-white">{project.name}</h2>
                    <p className="mt-2 text-sm text-slate-300">
                      {project.code} · {project.ownerName} · {project.stage.replaceAll("_", " ")}
                    </p>
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">{project.latestSummary}</p>
                  </div>
                  <div className="grid min-w-[220px] grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Progress</div>
                      <div className="mt-2 text-3xl font-semibold">{project.progressPct}%</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Health</div>
                      <div className="mt-2 text-3xl font-semibold">{project.healthScore}</div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {project.metrics.map((metric) => (
                    <MetricPill key={metric.label} label={metric.label} value={metric.value} />
                  ))}
                </div>

                <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr]">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Recent job thread</div>
                    <div className="mt-4 space-y-3">
                      {project.recentMessages.map((message) => (
                        <div key={message.id} className="rounded-xl border border-white/5 bg-white/5 p-3">
                          <div className="text-xs uppercase tracking-[0.16em] text-cyan-200">{message.author}</div>
                          <div className="mt-1 text-sm leading-6 text-slate-200">{message.body}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Upcoming tasks</div>
                    <div className="mt-4 space-y-3 text-sm text-slate-200">
                      {project.upcomingTasks.map((task) => (
                        <div key={task.id} className="rounded-xl border border-white/5 bg-white/5 p-3">
                          <div className="font-medium text-white">{task.title}</div>
                          <div className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">{task.priority} priority</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Mode behavior</div>
                    <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
                      <div>
                        <div className="text-xs uppercase tracking-[0.16em] text-cyan-200">Default dashboard</div>
                        <ul className="mt-1 list-disc space-y-1 pl-5">
                          {data.modeDefaults[project.mode].dashboard.slice(0, 4).map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.16em] text-cyan-200">Required forms</div>
                        <div>{data.modeDefaults[project.mode].requiredForms.join(" • ")}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {project.mode === "HEAVY_CIVIL" && project.quantityHighlights.length > 0 ? (
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-amber-200">Installed quantities</div>
                      <div className="mt-3 space-y-3 text-sm text-slate-100">
                        {project.quantityHighlights.map((item) => (
                          <div key={item.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-black/20 px-3 py-2">
                            <span>{item.description}</span>
                            <span>{item.installedQty}/{item.budgetQty} {item.unit}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-amber-200">Production rates</div>
                      <div className="mt-3 space-y-3 text-sm text-slate-100">
                        {project.productionHighlights.map((item) => (
                          <div key={item.id} className="rounded-xl border border-white/5 bg-black/20 px-3 py-2">
                            <div className="font-medium">{item.activity}</div>
                            <div className="text-xs text-slate-400">{item.crewName} · {item.locationTag}</div>
                            <div className="mt-1">{item.installedQty} {item.unit} @ {item.productionRate}/hr</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </article>
            ))}
          </div>

          <aside className="space-y-6">
            <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Tenant members</div>
              <div className="mt-4 space-y-3">
                {data.tenant.members.map((member) => (
                  <div key={`${member.email}-${member.role}`} className="rounded-xl border border-white/5 bg-white/5 p-3">
                    <div className="font-medium text-white">{member.user}</div>
                    <div className="text-xs uppercase tracking-[0.16em] text-cyan-200">{member.role.replaceAll("_", " ")}</div>
                    <div className="text-sm text-slate-400">{member.email}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Workflow templates</div>
              <div className="mt-4 space-y-3 text-sm text-slate-200">
                {data.workflowTemplates.map((template) => (
                  <div key={template.id} className="rounded-xl border border-white/5 bg-white/5 p-3">
                    <div className="font-medium text-white">{template.name}</div>
                    <div className="text-xs uppercase tracking-[0.16em] text-cyan-200">{template.module}</div>
                    <div className="mt-1 text-slate-400">{template.mode ? modeLabel(template.mode) : "Cross-mode"}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Recent audit trail</div>
              <div className="mt-4 space-y-3 text-sm text-slate-200">
                {data.auditTrail.map((event) => (
                  <div key={event.id} className="rounded-xl border border-white/5 bg-white/5 p-3">
                    <div className="font-medium text-white">{event.action} {event.entityType}</div>
                    <div className="text-xs uppercase tracking-[0.16em] text-cyan-200">{event.actorName}</div>
                    <div className="mt-1 text-slate-400">{new Date(event.createdAt).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}
