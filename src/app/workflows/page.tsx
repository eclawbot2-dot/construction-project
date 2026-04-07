import { AppLayout } from "@/components/layout/app-layout";
import { getDashboardData } from "@/lib/dashboard";
import { modeLabel, workflowStatusLabel } from "@/lib/utils";

export default async function WorkflowsPage() {
  const data = await getDashboardData();

  return (
    <AppLayout
      eyebrow="Pass 3 — Workflow and engagement"
      title="Workflow Center"
      description="Central place for mode packs, reusable workflow templates, approval intent, escalation concepts, and engagement defaults."
    >
      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <section className="card p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Mode-driven workflow templates</div>
          <div className="mt-4 space-y-4">
            {data?.workflowTemplates.map((template) => (
              <div key={template.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-medium text-white">{template.name}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">{template.module}</div>
                  </div>
                  <span className="badge-blue">{template.mode ? modeLabel(template.mode) : "Cross-mode"}</span>
                </div>
                <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-950/70 p-3 text-xs text-slate-300">{template.configJson}</pre>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-6">
          <div className="card p-6">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">User engagement model</div>
            <div className="mt-4 grid gap-4 md:grid-cols-3 xl:grid-cols-1">
              {Object.entries(data?.modeDefaults ?? {}).map(([mode, details]) => (
                <div key={mode} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="font-medium text-white">{modeLabel(mode)}</div>
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-300">
                    {details.engagement.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-6">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Approval / reminder / watcher logic to build out</div>
            <div className="mt-4 grid gap-3 text-sm text-slate-300">
              {[
                "Route RFIs and submittals through explicit ball-in-court ownership",
                "Allow job-thread watchers by project, channel, and record type",
                "Add reminder/SLA timers for overdue technical workflows",
                "Support external review participation for owners, subs, and design teams",
                "Drive digest notifications by role and urgency",
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-white/5 p-4">{item}</div>
              ))}
            </div>
          </div>

          <div className="card p-6">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Recent workflow runs</div>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              {data?.sharedServices.workflowEngine.recentRuns.length ? data.sharedServices.workflowEngine.recentRuns.map((run) => (
                <div key={run.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="font-medium text-white">{run.templateName}</div>
                  <div className="mt-1 text-xs text-slate-500">{run.module} · {workflowStatusLabel(run.status)}</div>
                </div>
              )) : <div className="rounded-2xl border border-white/10 bg-white/5 p-4">No recent workflow runs seeded yet.</div>}
            </div>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
