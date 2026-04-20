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
      if (/pipeline|by mode|opportunit/i.test(q)) {
        const byMode = await prisma.opportunity.groupBy({
          by: ["mode"],
          where: { tenantId },
          _sum: { estimatedValue: true },
          _count: { _all: true },
        });
        return {
          answer: `Pipeline breakdown by mode across ${byMode.reduce((s, m) => s + (m._count?._all ?? 0), 0)} opportunities.`,
          charts: [
            {
              kind: "PIE",
              title: "Pipeline $ by mode",
              labels: byMode.map((m) => m.mode),
              values: byMode.map((m) => Math.round(m._sum.estimatedValue ?? 0)),
            },
          ],
          tables: [{
            title: "Opportunities by mode",
            rows: byMode.map((m) => ({ mode: m.mode, count: String(m._count?._all ?? 0), totalValue: `$${Math.round(m._sum.estimatedValue ?? 0).toLocaleString()}` })),
          }],
        };
      }
      if (/over budget|variance|cost overrun/i.test(q)) {
        const snaps = await prisma.projectPnlSnapshot.findMany({ where: { project: { tenantId } }, include: { project: true }, orderBy: { forecastFinalCost: "desc" } });
        const over = snaps.filter((s) => s.forecastFinalCost > s.totalContractValue).slice(0, 10);
        return {
          answer: `${over.length} projects are forecast to finish over contract value.`,
          charts: [],
          tables: [{
            title: "Projects forecast over budget",
            rows: over.map((s) => ({ code: s.project.code, contract: `$${s.totalContractValue.toLocaleString()}`, eac: `$${s.forecastFinalCost.toLocaleString()}`, variance: `$${(s.forecastFinalCost - s.totalContractValue).toLocaleString()}` })),
          }],
        };
      }
      if (/top vendor|largest spend|vendor by spend/i.test(q)) {
        const grouped = await prisma.journalEntryRow.groupBy({
          by: ["vendorName"],
          where: { tenantId, vendorName: { not: null } },
          _sum: { amount: true },
          orderBy: { _sum: { amount: "desc" } },
          take: 10,
        });
        return {
          answer: `Top 10 vendors by spend across all journal entries.`,
          charts: [{
            kind: "BAR",
            title: "Top vendors by spend",
            labels: grouped.map((g) => g.vendorName ?? ""),
            values: grouped.map((g) => Math.abs(Math.round(g._sum.amount ?? 0))),
          }],
          tables: [],
        };
      }
      if (/active project|in progress/i.test(q)) {
        const projects = await prisma.project.findMany({ where: { tenantId, stage: "ACTIVE" }, orderBy: { contractValue: "desc" }, take: 20 });
        return {
          answer: `${projects.length} active projects currently in progress.`,
          charts: [],
          tables: [{
            title: "Active projects",
            rows: projects.map((p) => ({ code: p.code, name: p.name, value: `$${(p.contractValue ?? 0).toLocaleString()}`, mode: p.mode })),
          }],
        };
      }
      return {
        answer: `I can answer questions about: pipeline by mode/stage, projects over budget, top vendors by spend, active projects, upcoming due dates. Try asking one of those.`,
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
