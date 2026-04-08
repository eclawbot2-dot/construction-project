import { AppLayout } from "@/components/layout/app-layout";
import { getDashboardData } from "@/lib/dashboard";
import { formatDateTime, modeLabel, roleLabel, workflowStatusLabel } from "@/lib/utils";

export default async function WorkflowsPage() {
  const data = await getDashboardData();

  return (
    <AppLayout
      eyebrow="Pass 3 and 4 — Workflow + engagement depth"
      title="Workflow Center"
      description="Central place for workflow templates, watchers, notification rules, approval routing, escalation concepts, and mode-driven engagement logic."
    >
      <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
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
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Notification rules</div>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              {data?.sharedServices.notifications.map((rule) => (
                <div key={rule.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-white">{rule.name}</div>
                    <span className="badge-gold">{rule.delivery}</span>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">Trigger: {rule.triggerType} · Cadence: {rule.cadence ?? "instant"} · SLA: {rule.slaHours ?? 0}h</div>
                  <div className="mt-2 text-xs text-cyan-200">Role: {rule.roleTemplate ? roleLabel(rule.roleTemplate) : "Any"}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-6">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Recent workflow runs and watchers</div>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              {data?.projectWorkspaces.flatMap((project) => project.workflowRuns.map((run) => ({ project, run }))).map(({ project, run }) => (
                <div key={run.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-white">{run.templateName}</div>
                      <div className="mt-1 text-xs text-slate-500">{project.name} · {run.module}</div>
                    </div>
                    <span className="badge-blue">{workflowStatusLabel(run.status)}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {run.watchers.map((watcher) => (
                      <span key={watcher.id} className="badge-gray">{watcher.user?.name ?? "Unassigned"} · {watcher.channel}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

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
        </section>
      </div>

      <section className="mt-6 card p-6">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Approval routing and reminder logic coverage</div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data?.projectWorkspaces.flatMap((project) => project.approvalRoutes.map((route) => (
            <div key={route.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
              <div className="font-medium text-white">{route.name}</div>
              <div className="mt-1 text-xs text-slate-500">{project.name} · {route.targetType}</div>
              <div className="mt-2 text-xs text-cyan-200">Approver role: {route.approverRole ? roleLabel(route.approverRole) : "Any"}</div>
              <div className="mt-2 text-xs text-slate-500">Status: {workflowStatusLabel(route.status)}</div>
            </div>
          ))) }
        </div>
      </section>
    </AppLayout>
  );
}
