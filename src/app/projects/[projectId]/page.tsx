import { notFound } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { ProjectTabs } from "@/components/layout/project-tabs";
import { getProjectWorkspace } from "@/lib/dashboard";
import { formatCurrency, formatDate, formatDateTime, modeLabel, workflowStatusLabel } from "@/lib/utils";

export default async function ProjectWorkspacePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await getProjectWorkspace(projectId);

  if (!project) notFound();

  return (
    <AppLayout
      eyebrow="Pass 2 — Detailed workspace"
      title={project.name}
      description="A single project workspace that changes required tabs, operating rituals, and execution depth by project mode."
    >
      <div className="grid gap-6">
        <ProjectTabs projectId={project.id} active="overview" />

        <section className="grid gap-4 lg:grid-cols-4">
          <div className="card p-5 lg:col-span-2">
            <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Project identity</div>
            <div className="mt-3 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
              <div><span className="text-slate-500">Mode:</span> {modeLabel(project.mode)}</div>
              <div><span className="text-slate-500">Code:</span> {project.code}</div>
              <div><span className="text-slate-500">Owner:</span> {project.ownerName}</div>
              <div><span className="text-slate-500">Contract:</span> {project.contractType}</div>
              <div><span className="text-slate-500">Address:</span> {project.address}</div>
              <div><span className="text-slate-500">Value:</span> {formatCurrency(project.contractValue)}</div>
            </div>
          </div>
          <div className="card p-5">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Required forms</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {project.mode === "SIMPLE"
                ? ["Daily Summary", "Change Order Log", "Punch List"]
                : project.mode === "VERTICAL"
                  ? ["RFI", "Submittal", "Meeting Minutes", "Drawing Register"]
                  : ["Daily Production Report", "Ticket Reconciliation", "Pay Item Tracking"]
              .map((item) => <span key={item} className="badge-blue">{item}</span>)}
            </div>
          </div>
          <div className="card p-5">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Tabs enabled</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {project.tabs.map((item) => <span key={item} className="badge-gray">{item}</span>)}
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
          <div className="grid gap-6">
            <div className="card p-5">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Job thread / engagement stream</div>
              <div className="mt-4 space-y-3">
                {project.recentMessages.map((message) => (
                  <div key={message.id} className="rounded-2xl border border-white/5 bg-white/5 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-sm font-medium text-white">{message.author}</div>
                      <div className="text-xs text-slate-500">{formatDateTime(message.createdAt)}</div>
                    </div>
                    <div className="mt-2 text-sm leading-6 text-slate-300">{message.body}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-5">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Tasks and execution</div>
              <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
                <table className="min-w-full divide-y divide-white/10">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="table-header">Task</th>
                      <th className="table-header">Priority</th>
                      <th className="table-header">Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 bg-slate-950/40">
                    {project.upcomingTasks.map((task) => (
                      <tr key={task.id}>
                        <td className="table-cell">
                          <div className="font-medium text-white">{task.title}</div>
                          <div className="text-xs text-slate-500">{task.status.replaceAll("_", " ")}</div>
                        </td>
                        <td className="table-cell">{task.priority}</td>
                        <td className="table-cell">{formatDate(task.dueDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {project.mode !== "SIMPLE" ? (
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="card p-5">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">RFIs</div>
                  <div className="mt-4 space-y-3">
                    {project.rfis.map((rfi) => (
                      <div key={rfi.id} className="rounded-2xl border border-white/5 bg-white/5 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium text-white">{rfi.number}</div>
                          <span className="badge-gold">{workflowStatusLabel(rfi.status)}</span>
                        </div>
                        <div className="mt-2 text-sm text-slate-300">{rfi.subject}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="card p-5">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Submittals</div>
                  <div className="mt-4 space-y-3">
                    {project.submittals.map((submittal) => (
                      <div key={submittal.id} className="rounded-2xl border border-white/5 bg-white/5 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium text-white">{submittal.number}</div>
                          <span className="badge-blue">{workflowStatusLabel(submittal.status)}</span>
                        </div>
                        <div className="mt-2 text-sm text-slate-300">{submittal.title}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {project.mode === "HEAVY_CIVIL" ? (
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="card p-5">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Installed quantities</div>
                  <div className="mt-4 space-y-3">
                    {project.quantityHighlights.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-white/5 bg-white/5 p-4">
                        <div className="font-medium text-white">{item.description}</div>
                        <div className="mt-2 text-sm text-slate-300">{item.installedQty} / {item.budgetQty} {item.unit}</div>
                        <div className="mt-1 text-xs text-slate-500">{item.locationTag}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="card p-5">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Production records</div>
                  <div className="mt-4 space-y-3">
                    {project.productionHighlights.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-white/5 bg-white/5 p-4">
                        <div className="font-medium text-white">{item.activity}</div>
                        <div className="mt-2 text-sm text-slate-300">{item.installedQty} {item.unit} · {item.productionRate}/hr</div>
                        <div className="mt-1 text-xs text-slate-500">{item.crewName} · {item.locationTag}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <aside className="grid gap-6">
            <div className="card p-5">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Latest daily logs</div>
              <div className="mt-4 space-y-3">
                {project.dailyLogs.map((log) => (
                  <div key={log.id} className="rounded-2xl border border-white/5 bg-white/5 p-4">
                    <div className="font-medium text-white">{formatDate(log.logDate)}</div>
                    <div className="mt-2 text-sm text-slate-300">{log.summary}</div>
                    <div className="mt-2 text-xs text-slate-500">Weather: {log.weather} · Manpower: {log.manpower}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-5">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Documents</div>
              <div className="mt-4 space-y-3 text-sm text-slate-300">
                {project.documents.map((document) => (
                  <div key={document.id} className="rounded-2xl border border-white/5 bg-white/5 p-4">
                    <div className="font-medium text-white">{document.title}</div>
                    <div className="mt-1 text-xs text-slate-500">{document.documentClass} · {document.folderPath}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-5">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Meetings / workflow runs</div>
              <div className="mt-4 space-y-3 text-sm text-slate-300">
                {project.meetings.map((meeting) => (
                  <div key={meeting.id} className="rounded-2xl border border-white/5 bg-white/5 p-4">
                    <div className="font-medium text-white">{meeting.title}</div>
                    <div className="mt-1 text-xs text-slate-500">{meeting.meetingType} · {formatDateTime(meeting.scheduledAt)}</div>
                  </div>
                ))}
                {project.workflowRuns.map((run) => (
                  <div key={run.id} className="rounded-2xl border border-white/5 bg-white/5 p-4">
                    <div className="font-medium text-white">{run.templateName}</div>
                    <div className="mt-1 text-xs text-slate-500">{workflowStatusLabel(run.status)}</div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </AppLayout>
  );
}
