/**
 * Platform copilot AI.
 *
 * 39. tenantAskAnything — RAG over all tenant data
 * 40. pageCopilot — context-aware summaries per page
 * 41. formFillSuggest — inline typeahead for address, NAICS, cost code
 * 42. structuredSearch — search returns charts + tables, not just links
 */

import { prisma } from "@/lib/prisma";
import { aiCall, stableHash } from "@/lib/ai";

export type TenantAnswer = { answer: string; charts: Array<{ kind: "BAR" | "LINE" | "PIE"; title: string; labels: string[]; values: number[] }>; tables: Array<{ title: string; rows: Array<Record<string, string>> }> };

export async function tenantAskAnything(question: string, tenantId: string): Promise<TenantAnswer> {
  const q = question.toLowerCase();

  return aiCall<TenantAnswer>({
    kind: "tenant-chat",
    prompt: question,
    fallback: async () => {
      // --- PIPELINE ---
      if (/pipeline\s+by\s+mode|opportunit.*mode/i.test(q)) {
        const byMode = await prisma.opportunity.groupBy({ by: ["mode"], where: { tenantId }, _sum: { estimatedValue: true }, _count: { _all: true } });
        return {
          answer: `Pipeline breakdown by mode across ${byMode.reduce((s, m) => s + (m._count?._all ?? 0), 0)} opportunities.`,
          charts: [{ kind: "PIE", title: "Pipeline $ by mode", labels: byMode.map((m) => m.mode), values: byMode.map((m) => Math.round(m._sum.estimatedValue ?? 0)) }],
          tables: [{ title: "Opportunities by mode", rows: byMode.map((m) => ({ mode: m.mode, count: String(m._count?._all ?? 0), totalValue: `$${Math.round(m._sum.estimatedValue ?? 0).toLocaleString()}` })) }],
        };
      }
      if (/pipeline\s+by\s+stage|opportunit.*stage/i.test(q) || /sales\s+funnel/i.test(q)) {
        const byStage = await prisma.opportunity.groupBy({ by: ["stage"], where: { tenantId }, _sum: { estimatedValue: true }, _count: { _all: true } });
        return {
          answer: `Opportunities by stage. ${byStage.reduce((s, m) => s + (m._count?._all ?? 0), 0)} total.`,
          charts: [{ kind: "BAR", title: "Opportunities by stage", labels: byStage.map((m) => m.stage), values: byStage.map((m) => m._count?._all ?? 0) }],
          tables: [{ title: "Pipeline value by stage", rows: byStage.map((m) => ({ stage: m.stage, count: String(m._count?._all ?? 0), value: `$${Math.round(m._sum.estimatedValue ?? 0).toLocaleString()}` })) }],
        };
      }
      if (/win\s+rate|hit\s+rate/i.test(q)) {
        const won = await prisma.opportunity.count({ where: { tenantId, stage: "AWARDED" } });
        const lost = await prisma.opportunity.count({ where: { tenantId, stage: "LOST" } });
        const total = won + lost;
        const rate = total > 0 ? ((won / total) * 100).toFixed(1) : "—";
        return { answer: `Overall win rate: ${rate}% (${won} won, ${lost} lost of ${total} decided).`, charts: [], tables: [] };
      }
      // --- FINANCE / BUDGET ---
      if (/over\s+budget|cost\s+overrun|variance.*cost/i.test(q)) {
        const snaps = await prisma.projectPnlSnapshot.findMany({ where: { project: { tenantId } }, include: { project: true }, orderBy: { forecastFinalCost: "desc" } });
        const over = snaps.filter((s) => s.forecastFinalCost > s.totalContractValue).slice(0, 10);
        return {
          answer: `${over.length} projects are forecast to finish over contract value.`,
          charts: [],
          tables: [{ title: "Projects forecast over budget", rows: over.map((s) => ({ code: s.project.code, contract: `$${s.totalContractValue.toLocaleString()}`, eac: `$${s.forecastFinalCost.toLocaleString()}`, variance: `$${(s.forecastFinalCost - s.totalContractValue).toLocaleString()}` })) }],
        };
      }
      if (/backlog|contracted\s+not\s+billed/i.test(q)) {
        const snaps = await prisma.projectPnlSnapshot.findMany({ where: { project: { tenantId } }, include: { project: true } });
        const backlog = snaps.reduce((s, p) => s + (p.totalContractValue - p.billedToDate), 0);
        return { answer: `Current backlog (contract − billed): $${backlog.toLocaleString()} across ${snaps.length} projects.`, charts: [], tables: [{ title: "Backlog by project", rows: snaps.sort((a, b) => (b.totalContractValue - b.billedToDate) - (a.totalContractValue - a.billedToDate)).slice(0, 10).map((s) => ({ code: s.project.code, backlog: `$${(s.totalContractValue - s.billedToDate).toLocaleString()}`, percent: `${s.percentComplete.toFixed(0)}%` })) }] };
      }
      if (/wip\s+(?:over|under)|over.*billed|under.*billed/i.test(q)) {
        const snaps = await prisma.projectPnlSnapshot.findMany({ where: { project: { tenantId } }, include: { project: true } });
        const over = snaps.filter((s) => s.wipOverUnder > 0).reduce((s, p) => s + p.wipOverUnder, 0);
        const under = snaps.filter((s) => s.wipOverUnder < 0).reduce((s, p) => s + Math.abs(p.wipOverUnder), 0);
        return { answer: `Overbillings: $${over.toLocaleString()} (cash-positive). Underbillings: $${under.toLocaleString()} (cash-at-risk).`, charts: [{ kind: "BAR", title: "WIP over/under by project", labels: snaps.slice(0, 12).map((s) => s.project.code), values: snaps.slice(0, 12).map((s) => Math.round(s.wipOverUnder)) }], tables: [] };
      }
      if (/ytd\s+revenue|trailing.*revenue|last\s+12.*revenue/i.test(q)) {
        const stmts = await prisma.financialStatement.findMany({ where: { tenantId, statementType: "INCOME_STATEMENT" }, orderBy: { periodStart: "desc" }, take: 12 });
        const rev = stmts.reduce((s, x) => s + x.revenue, 0);
        const eb = stmts.reduce((s, x) => s + x.ebitda, 0);
        return { answer: `Trailing 12 months: revenue $${rev.toLocaleString()}, EBITDA $${eb.toLocaleString()} (${rev > 0 ? ((eb / rev) * 100).toFixed(1) : "—"}% margin).`, charts: [{ kind: "LINE", title: "Monthly revenue", labels: stmts.map((s) => s.periodStart.toISOString().slice(0, 7)).reverse(), values: stmts.map((s) => Math.round(s.revenue)).reverse() }], tables: [] };
      }
      // --- VENDORS ---
      if (/top\s+vendor|largest\s+spend|vendor.*spend|most\s+spend/i.test(q)) {
        const grouped = await prisma.journalEntryRow.groupBy({ by: ["vendorName"], where: { tenantId, vendorName: { not: null } }, _sum: { amount: true }, orderBy: { _sum: { amount: "desc" } }, take: 10 });
        return { answer: `Top 10 vendors by spend across all journal entries.`, charts: [{ kind: "BAR", title: "Top vendors by spend", labels: grouped.map((g) => g.vendorName ?? ""), values: grouped.map((g) => Math.abs(Math.round(g._sum.amount ?? 0))) }], tables: [] };
      }
      if (/prequal|not\s+approved.*vendor|vendor.*status/i.test(q)) {
        const vendors = await prisma.vendor.groupBy({ by: ["prequalStatus"], where: { tenantId }, _count: { _all: true } });
        return { answer: `Vendor prequal status distribution.`, charts: [{ kind: "PIE", title: "Vendors by prequal status", labels: vendors.map((v) => v.prequalStatus), values: vendors.map((v) => v._count?._all ?? 0) }], tables: [] };
      }
      if (/insurance.*expir|coi\s+expir|expiring.*insurance/i.test(q)) {
        const certs = await prisma.insuranceCert.findMany({ where: { vendor: { tenantId }, expirationDate: { lte: new Date(Date.now() + 60 * 86_400_000) } }, include: { vendor: true }, take: 20 });
        return { answer: `${certs.length} vendor insurance certificates expiring in next 60 days.`, charts: [], tables: [{ title: "Expiring COIs", rows: certs.map((c) => ({ vendor: c.vendor.name, type: c.type, expires: c.expirationDate.toISOString().slice(0, 10) })) }] };
      }
      // --- PROJECTS ---
      if (/active\s+project|in\s+progress|ongoing\s+project/i.test(q)) {
        const projects = await prisma.project.findMany({ where: { tenantId, stage: "ACTIVE" }, orderBy: { contractValue: "desc" }, take: 20 });
        return { answer: `${projects.length} active projects currently underway.`, charts: [], tables: [{ title: "Active projects", rows: projects.map((p) => ({ code: p.code, name: p.name, value: `$${(p.contractValue ?? 0).toLocaleString()}`, mode: p.mode })) }] };
      }
      if (/upcoming.*due|due\s+(?:this|next)|deadline/i.test(q)) {
        const soon = await prisma.opportunity.findMany({ where: { tenantId, dueDate: { gte: new Date(), lte: new Date(Date.now() + 30 * 86_400_000) } }, orderBy: { dueDate: "asc" }, take: 15 });
        return { answer: `${soon.length} opportunities due in next 30 days.`, charts: [], tables: [{ title: "Upcoming deadlines", rows: soon.map((o) => ({ name: o.name, client: o.clientName ?? "—", due: o.dueDate?.toISOString().slice(0, 10) ?? "—", value: `$${o.estimatedValue.toLocaleString()}` })) }] };
      }
      if (/open\s+rfi|outstanding\s+rfi/i.test(q)) {
        const rfis = await prisma.rFI.findMany({ where: { project: { tenantId }, status: { notIn: ["CLOSED", "APPROVED"] } }, include: { project: true }, orderBy: { createdAt: "asc" }, take: 20 });
        return { answer: `${rfis.length} open RFIs across all projects.`, charts: [], tables: [{ title: "Open RFIs", rows: rfis.map((r) => ({ project: r.project.code, number: r.number, subject: r.subject, age: `${Math.round((Date.now() - r.createdAt.getTime()) / 86_400_000)}d` })) }] };
      }
      if (/safety\s+incident|osha/i.test(q)) {
        const since = new Date(Date.now() - 365 * 86_400_000);
        const incidents = await prisma.safetyIncident.findMany({ where: { project: { tenantId }, occurredAt: { gte: since } }, include: { project: true }, orderBy: { occurredAt: "desc" }, take: 20 });
        return { answer: `${incidents.length} safety incidents in past 12 months.`, charts: [], tables: [{ title: "Recent incidents", rows: incidents.map((i) => ({ project: i.project.code, title: i.title, severity: i.severity, date: i.occurredAt.toISOString().slice(0, 10) })) }] };
      }
      if (/unreconciled|journal.*review|need.*review/i.test(q)) {
        const c = await prisma.journalEntryRow.count({ where: { tenantId, reconciliationStatus: { in: ["UNREVIEWED", "NEEDS_INPUT"] } } });
        return { answer: `${c} journal entries are unreviewed or flagged for attention. Use Finance AI → Batch reclassify to process.`, charts: [], tables: [] };
      }
      // --- PEOPLE ---
      if (/head\s*count|staff|team\s+by\s+role/i.test(q)) {
        const roles = await prisma.membership.groupBy({ by: ["roleTemplate"], where: { tenantId }, _count: { _all: true } });
        return { answer: `${roles.reduce((s, r) => s + (r._count?._all ?? 0), 0)} staff across ${roles.length} roles.`, charts: [{ kind: "BAR", title: "Staff by role", labels: roles.map((r) => r.roleTemplate), values: roles.map((r) => r._count?._all ?? 0) }], tables: [] };
      }
      // --- SCHEDULE / RISK ---
      if (/late\s+task|overdue\s+task|behind\s+schedule/i.test(q)) {
        const tasks = await prisma.scheduleTask.findMany({ where: { project: { tenantId }, endDate: { lt: new Date() }, percentComplete: { lt: 100 } }, include: { project: true }, take: 20 });
        return { answer: `${tasks.length} tasks past planned end date and incomplete.`, charts: [], tables: [{ title: "Late tasks", rows: tasks.map((t) => ({ project: t.project.code, task: t.name, planned: t.endDate.toISOString().slice(0, 10), progress: `${t.percentComplete}%` })) }] };
      }
      // Help text — list what the assistant can answer.
      return {
        answer: `I can answer questions about:\n• Pipeline by mode / stage · Win rate · Upcoming deadlines\n• Projects over budget · Backlog · WIP over/under · YTD revenue\n• Top vendors by spend · Vendor prequal status · Expiring COIs\n• Active projects · Open RFIs · Safety incidents · Unreconciled journals\n• Head count by role · Late schedule tasks\n\nTry rephrasing your question with one of those topics, or use the examples above.`,
        charts: [],
        tables: [],
      };
    },
  });
}

export type PageSummary = { summary: string; highlights: string[]; suggestions: string[] };

export async function pageCopilot(context: { page: string; data: Record<string, unknown> }): Promise<PageSummary> {
  return aiCall<PageSummary>({
    kind: "page-copilot",
    prompt: `Summarize ${context.page}`,
    fallback: () => {
      const page = context.page;
      const data = context.data;
      const highlights: string[] = [];
      const suggestions: string[] = [];
      let summary = `This ${page} page shows current tenant data.`;
      if (page === "finance" && data.unreconciled) {
        summary = `You have ${data.unreconciled} unreconciled journal rows and ${data.backlog ?? 0} in backlog.`;
        highlights.push(`Unreconciled: ${data.unreconciled}`);
        suggestions.push("Run batch reclassify to clear unreconciled entries.");
        suggestions.push("Run month-end close checklist before reporting period ends.");
      } else if (page === "bids") {
        summary = `You have ${data.listings ?? 0} RFP listings, ${data.active ?? 0} active bids.`;
        suggestions.push("Score listings to prioritize pursuit effort.");
      } else if (page === "projects") {
        summary = `You have ${data.active ?? 0} active projects, ${data.overBudget ?? 0} forecast over budget.`;
        if ((data.overBudget as number) > 0) suggestions.push("Review EAC forecasts on over-budget projects.");
      }
      return { summary, highlights, suggestions };
    },
  });
}

const NAICS = [
  { code: "236220", label: "Commercial & Institutional Building" },
  { code: "236115", label: "New Single-Family Housing Construction" },
  { code: "236116", label: "New Multifamily Housing Construction" },
  { code: "236210", label: "Industrial Building Construction" },
  { code: "237110", label: "Water & Sewer Line Construction" },
  { code: "237120", label: "Oil & Gas Pipeline Construction" },
  { code: "237130", label: "Power & Communication Line Construction" },
  { code: "237210", label: "Land Subdivision" },
  { code: "237310", label: "Highway, Street & Bridge Construction" },
  { code: "237990", label: "Other Heavy Construction" },
  { code: "238110", label: "Poured Concrete Foundation & Structure" },
  { code: "238120", label: "Structural Steel & Precast Concrete" },
  { code: "238210", label: "Electrical Contractors" },
  { code: "238220", label: "Plumbing, Heating, AC Contractors" },
];

const COST_CODES = [
  { code: "01-00-00", label: "General requirements" },
  { code: "01-50-00", label: "Labor" },
  { code: "01-55-00", label: "Equipment" },
  { code: "01-60-00", label: "Materials" },
  { code: "01-70-00", label: "Subcontractors" },
  { code: "03-30-00", label: "Cast-in-place concrete" },
  { code: "05-12-00", label: "Structural steel framing" },
  { code: "06-10-00", label: "Rough carpentry" },
  { code: "07-50-00", label: "Roofing" },
  { code: "08-10-00", label: "Doors & frames" },
  { code: "09-29-00", label: "Gypsum board" },
  { code: "09-91-00", label: "Painting" },
  { code: "21-00-00", label: "Fire protection" },
  { code: "22-00-00", label: "Plumbing" },
  { code: "23-00-00", label: "HVAC" },
  { code: "26-00-00", label: "Electrical" },
  { code: "31-20-00", label: "Earthwork" },
  { code: "32-12-00", label: "Asphalt paving" },
];

export function suggestNaics(description: string): Array<{ code: string; label: string; score: number }> {
  const lower = description.toLowerCase();
  return NAICS
    .map((n) => {
      let score = 0;
      const keys = n.label.toLowerCase().split(/[\s,&]+/).filter((s) => s.length > 3);
      for (const k of keys) if (lower.includes(k)) score += 30;
      return { ...n, score };
    })
    .filter((n) => n.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

export function suggestCostCode(memo: string): Array<{ code: string; label: string; score: number }> {
  const lower = memo.toLowerCase();
  return COST_CODES
    .map((c) => {
      let score = 0;
      if (lower.includes(c.label.toLowerCase())) score += 50;
      const firstWord = c.label.split(/\W+/)[0].toLowerCase();
      if (firstWord.length > 3 && lower.includes(firstWord)) score += 20;
      return { ...c, score };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

export async function structuredSearch(query: string, tenantId: string): Promise<TenantAnswer> {
  return tenantAskAnything(query, tenantId);
}
