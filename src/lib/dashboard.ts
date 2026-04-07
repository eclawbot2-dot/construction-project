import { ProjectMode, ThreadChannel, WorkflowStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;

function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseJsonObject<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function getDashboardData() {
  const tenant = await prisma.tenant.findFirst({
    include: {
      businessUnits: true,
      workflowTemplates: true,
      companies: true,
      contacts: true,
      projects: {
        include: {
          threads: {
            include: {
              messages: {
                orderBy: { createdAt: "desc" },
                take: 5,
                include: { author: true },
              },
            },
          },
          tasks: {
            include: { assignee: true },
            orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
          },
          documents: true,
          rfis: true,
          submittals: true,
          dailyLogs: { orderBy: { logDate: "desc" }, take: 3 },
          budgets: { include: { lines: true } },
          quantities: true,
          productionEntries: true,
          tickets: true,
          meetings: true,
          safetyIncidents: true,
          punchItems: true,
          workflowRuns: true,
        },
        orderBy: { createdAt: "asc" },
      },
      memberships: {
        include: { user: true, businessUnit: true },
      },
      auditEvents: {
        include: { actor: true },
        orderBy: { createdAt: "desc" },
        take: 12,
      },
    },
  });

  if (!tenant) return null;

  const projectsByMode = Object.values(ProjectMode).map((mode) => {
    const projects = tenant.projects.filter((project) => project.mode === mode);
    return {
      mode,
      count: projects.length,
      avgHealth: projects.length ? Math.round(projects.reduce((sum, p) => sum + p.healthScore, 0) / projects.length) : 0,
      progressAvg: projects.length ? Math.round(projects.reduce((sum, p) => sum + p.progressPct, 0) / projects.length) : 0,
    };
  });

  const kpis = {
    projects: tenant.projects.length,
    openTasks: tenant.projects.reduce((sum, project) => sum + project.tasks.filter((task) => task.status !== "COMPLETE").length, 0),
    activeRfis: tenant.projects.reduce((sum, project) => sum + project.rfis.filter((rfi) => rfi.status !== WorkflowStatus.CLOSED).length, 0),
    activeSubmittals: tenant.projects.reduce((sum, project) => sum + project.submittals.filter((submittal) => submittal.status !== WorkflowStatus.CLOSED).length, 0),
    tickets: tenant.projects.reduce((sum, project) => sum + project.tickets.length, 0),
    documents: tenant.projects.reduce((sum, project) => sum + project.documents.length, 0),
    incidents: tenant.projects.reduce((sum, project) => sum + project.safetyIncidents.length, 0),
    punchItems: tenant.projects.reduce((sum, project) => sum + project.punchItems.length, 0),
  };

  const dashboardCards = tenant.projects.map((project) => {
    const budget = project.budgets[0];
    const latestThread = project.threads.find((thread) => thread.isDefault) ?? project.threads[0];
    const config = parseJsonObject<Record<string, unknown>>(project.configurationJson, {});

    return {
      id: project.id,
      name: project.name,
      code: project.code,
      mode: project.mode,
      stage: project.stage,
      ownerName: project.ownerName,
      address: project.address,
      contractType: project.contractType,
      contractValue: project.contractValue,
      progressPct: project.progressPct,
      healthScore: project.healthScore,
      dashboardVariant:
        project.mode === ProjectMode.SIMPLE ? "simple" : project.mode === ProjectMode.VERTICAL ? "vertical" : "heavy-civil",
      enabledPacks: parseJsonArray(tenant.featurePacks),
      config,
      metrics:
        project.mode === ProjectMode.SIMPLE
          ? [
              { label: "Open tasks", value: project.tasks.filter((task) => task.status !== "COMPLETE").length },
              { label: "Photos/docs", value: project.documents.length },
              { label: "Budget", value: `$${Math.round((budget?.currentValue ?? 0) / 1000)}k` },
              { label: "Punch", value: project.punchItems.length },
            ]
          : project.mode === ProjectMode.VERTICAL
            ? [
                { label: "RFIs", value: project.rfis.length },
                { label: "Submittals", value: project.submittals.length },
                { label: "Meetings", value: project.meetings.length },
                { label: "Budget", value: `$${Math.round((budget?.currentValue ?? 0) / 1000000)}M` },
              ]
            : [
                { label: "Quantities", value: project.quantities.length },
                { label: "Production entries", value: project.productionEntries.length },
                { label: "Tickets", value: project.tickets.length },
                { label: "Budget", value: `$${Math.round((budget?.currentValue ?? 0) / 1000000)}M` },
              ],
      latestSummary: project.dailyLogs[0]?.summary ?? "No daily summary yet",
      recentMessages:
        latestThread?.messages.map((message) => ({
          id: message.id,
          body: message.body,
          author: message.author.name,
          createdAt: message.createdAt.toISOString(),
        })) ?? [],
      budgetLines: budget?.lines ?? [],
      quantityHighlights: project.quantities,
      productionHighlights: project.productionEntries,
      dailyLogs: project.dailyLogs,
      rfis: project.rfis,
      submittals: project.submittals,
      meetings: project.meetings,
      documents: project.documents,
      safetyIncidents: project.safetyIncidents,
      punchItems: project.punchItems,
      workflowRuns: project.workflowRuns,
      upcomingTasks: project.tasks
        .filter((task) => task.status !== "COMPLETE")
        .sort((a, b) => (a.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER))
        .slice(0, 6),
      channels: project.threads.map((thread) => ({ title: thread.title, channel: thread.channel })),
    };
  });

  const modeDefaults = {
    [ProjectMode.SIMPLE]: {
      dashboard: ["Active jobs", "Overdue tasks", "Recent job thread activity", "Pending approvals", "Budget health", "Punch items"],
      requiredForms: ["Daily Summary", "Change Order Log", "Punch List"],
      terms: { project: "Job", thread: "Job Thread" },
      engagement: ["Client updates", "Selection tracking", "Photo-first progress", "Fast approvals"],
    },
    [ProjectMode.VERTICAL]: {
      dashboard: ["Overdue RFIs", "Submittal aging", "Change events", "Manpower", "Inspections", "Commitments and billings", "Procurement risks"],
      requiredForms: ["RFI", "Submittal", "Meeting Minutes", "Drawing Register"],
      terms: { observation: "Observation", issue: "Punch" },
      engagement: ["Document control", "Design team routing", "Formal meeting cadence", "Procurement oversight"],
    },
    [ProjectMode.HEAVY_CIVIL]: {
      dashboard: ["Installed vs budgeted quantities", "Production rates", "Crew/equipment utilization", "Hauling/ticket counts", "Cost-to-complete by activity", "Weather/delay impacts"],
      requiredForms: ["Daily Production Report", "Ticket Reconciliation", "Pay Item Tracking"],
      terms: { issue: "Field Issue", quantity: "Installed Quantity" },
      engagement: ["Field reporting", "Ticket reconciliation", "Quantity backup", "Crew production control"],
    },
  };

  const projectWorkspaces = dashboardCards.map((project) => ({
    ...project,
    tabs:
      project.mode === ProjectMode.SIMPLE
        ? ["Overview", "Job Thread", "Tasks", "Budget", "Daily Summary", "Punch", "Client Portal"]
        : project.mode === ProjectMode.VERTICAL
          ? ["Overview", "Drawings", "RFIs", "Submittals", "Meetings", "Budget", "Quality/Safety", "Closeout"]
          : ["Overview", "Production", "Quantities", "Tickets", "Equipment", "Materials", "Compliance", "Claims Support"],
  }));

  const sharedServices = {
    crm: {
      companyCount: tenant.companies.length,
      contactCount: tenant.contacts.length,
      markets: [...new Set(tenant.companies.map((company) => company.market).filter(Boolean))],
    },
    workforce: {
      memberships: tenant.memberships.length,
      byRole: tenant.memberships.reduce<Record<string, number>>((acc, membership) => {
        acc[membership.roleTemplate] = (acc[membership.roleTemplate] ?? 0) + 1;
        return acc;
      }, {}),
    },
    workflowEngine: {
      templateCount: tenant.workflowTemplates.length,
      recentRuns: tenant.projects.flatMap((project) => project.workflowRuns).slice(0, 8),
    },
  };

  return {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      primaryMode: tenant.primaryMode,
      enabledModes: parseJsonArray(tenant.enabledModes),
      featurePacks: parseJsonArray(tenant.featurePacks),
      terminology: parseJsonObject<Record<string, string>>(tenant.terminology, {}),
      businessUnits: tenant.businessUnits,
      members: tenant.memberships.map((membership) => ({
        role: membership.roleTemplate,
        businessUnit: membership.businessUnit?.name ?? "Shared",
        user: membership.user.name,
        email: membership.user.email,
      })),
    },
    kpis,
    projectsByMode,
    dashboardCards,
    projectWorkspaces,
    workflowTemplates: tenant.workflowTemplates,
    auditTrail: tenant.auditEvents.map((event) => ({
      ...event,
      actorName: event.actor?.name ?? "System",
    })),
    modeDefaults,
    threadChannels: Object.values(ThreadChannel),
    sharedServices,
  };
}

export async function getProjectWorkspace(projectId: string) {
  const data = await getDashboardData();
  if (!data) return null;
  return data.projectWorkspaces.find((project) => project.id === projectId) ?? null;
}
