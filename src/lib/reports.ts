/**
 * Report builders. Each function returns a JSON shape that can be
 * rendered as a UI table OR exported to CSV via toCsv() in src/lib/csv.ts.
 *
 * All functions are tenant-scoped — pass the tenantId in.
 *
 * R1 wipReport — surety-grade WIP, over/under billed, change-order-aware
 * R2 costToCompleteForecast — by cost code, ETC + EAC
 * R3 marginFadeTrend — gross margin trend by month / project
 * R4 winRateAnalytics — bid win rate by client / PM / estimator
 * R5 estimateAccuracyReport — bid estimate vs actual at completion
 * R6 resourceHeatmap — labor + equipment allocation across projects
 * R7 bondingCapacityReport — surety reporting by entity
 */

import { prisma } from "@/lib/prisma";
import { sumMoney, subtractMoney, multiplyMoney, toNum } from "@/lib/money";

// ─── R1 — Surety-grade WIP report ──────────────────────────────────

export type WipRow = {
  projectId: string;
  projectName: string;
  contractValue: number;
  costsToDate: number;
  billedToDate: number;
  estimatedFinalCost: number;
  percentComplete: number;
  earnedRevenue: number;
  overBilled: number;
  underBilled: number;
  forecastGrossMargin: number;
};

export async function wipReport(tenantId: string, _asOf: Date = new Date()): Promise<WipRow[]> {
  const projects = await prisma.project.findMany({
    where: { tenantId },
    include: { pnlSnapshot: true },
  });
  return projects.map((p) => {
    const snap = p.pnlSnapshot;
    const contract = snap?.totalContractValue ?? toNum(p.contractValue);
    const billed = snap?.billedToDate ?? 0;
    const cost = snap?.costsToDate ?? 0;
    const efc = snap?.forecastFinalCost ?? cost;
    const pct = efc > 0 ? Math.min(1, cost / efc) : 0;
    const earned = multiplyMoney(contract, pct);
    const over = Math.max(0, subtractMoney(billed, earned));
    const under = Math.max(0, subtractMoney(earned, billed));
    return {
      projectId: p.id,
      projectName: p.name,
      contractValue: contract,
      costsToDate: cost,
      billedToDate: billed,
      estimatedFinalCost: efc,
      percentComplete: pct,
      earnedRevenue: earned,
      overBilled: over,
      underBilled: under,
      forecastGrossMargin: snap?.forecastGrossMargin ?? 0,
    } satisfies WipRow;
  });
}

// ─── R2 — Cost-to-complete forecast ────────────────────────────────

export type CtcRow = {
  projectId: string;
  costCode: string;
  budgeted: number;
  spent: number;
  committed: number;
  remaining: number;
  estimateAtCompletion: number;
};

export async function costToCompleteForecast(tenantId: string): Promise<CtcRow[]> {
  const projects = await prisma.project.findMany({
    where: { tenantId },
    include: {
      budgets: {
        include: {
          lines: true,
        },
      },
    },
  });
  const out: CtcRow[] = [];
  for (const p of projects) {
    for (const b of p.budgets) {
      for (const line of b.lines) {
        const spent = line.actualCost ?? 0;
        const committed = line.committedCost ?? 0;
        const budgeted = line.budgetAmount ?? 0;
        const remaining = Math.max(0, subtractMoney(budgeted, sumMoney([spent, committed])));
        const eac = sumMoney([spent, committed, remaining]);
        out.push({
          projectId: p.id,
          costCode: line.code ?? line.description,
          budgeted,
          spent,
          committed,
          remaining,
          estimateAtCompletion: eac,
        });
      }
    }
  }
  return out;
}

// ─── R3 — Margin-fade trend ───────────────────────────────────────

export type MarginFadePoint = {
  projectId: string;
  projectName: string;
  asOf: Date;
  forecastGrossMargin: number;
};

export async function marginFadeTrend(tenantId: string, monthsBack: number = 12): Promise<MarginFadePoint[]> {
  const since = new Date();
  since.setMonth(since.getMonth() - monthsBack);
  const snapshots = await prisma.projectPnlSnapshot.findMany({
    where: { project: { tenantId }, asOf: { gte: since } },
    orderBy: [{ projectId: "asc" }, { asOf: "asc" }],
    include: { project: true },
  });
  return snapshots.map((s) => ({
    projectId: s.projectId,
    projectName: s.project.name,
    asOf: s.asOf,
    forecastGrossMargin: s.forecastGrossMargin ?? 0,
  }));
}

// ─── R4 — Bid win rate ─────────────────────────────────────────────

export type WinRateRow = {
  scope: string;
  total: number;
  won: number;
  lost: number;
  winRate: number;
};

export async function winRateAnalytics(tenantId: string): Promise<{ byOwner: WinRateRow[] }> {
  const opps = await prisma.opportunity.findMany({ where: { tenantId } });
  const byOwner = new Map<string, { total: number; won: number; lost: number }>();
  for (const o of opps) {
    const owner = o.ownerName ?? "(unassigned)";
    const slot = byOwner.get(owner) ?? { total: 0, won: 0, lost: 0 };
    slot.total += 1;
    if (o.stage === "AWARDED") slot.won += 1;
    if (o.stage === "LOST" || o.stage === "WITHDRAWN") slot.lost += 1;
    byOwner.set(owner, slot);
  }
  const rows: WinRateRow[] = [];
  for (const [owner, s] of byOwner.entries()) {
    const decided = s.won + s.lost;
    rows.push({
      scope: owner,
      total: s.total,
      won: s.won,
      lost: s.lost,
      winRate: decided > 0 ? s.won / decided : 0,
    });
  }
  rows.sort((a, b) => b.winRate - a.winRate);
  return { byOwner: rows };
}

// ─── R5 — Estimate accuracy ────────────────────────────────────────

export type EstimateAccuracyRow = {
  projectId: string;
  projectName: string;
  bidEstimate: number;
  actualFinalCost: number;
  variance: number;
  variancePct: number;
};

export async function estimateAccuracyReport(tenantId: string): Promise<EstimateAccuracyRow[]> {
  const projects = await prisma.project.findMany({
    where: { tenantId, stage: { in: ["CLOSEOUT", "WARRANTY"] } },
    include: { pnlSnapshot: true },
  });
  return projects.map((p) => {
    const snap = p.pnlSnapshot;
    const bid = toNum(p.contractValue);
    const actual = snap?.forecastFinalCost ?? snap?.costsToDate ?? 0;
    const variance = actual - bid;
    const pct = bid > 0 ? variance / bid : 0;
    return {
      projectId: p.id,
      projectName: p.name,
      bidEstimate: bid,
      actualFinalCost: actual,
      variance,
      variancePct: pct,
    };
  });
}

// ─── R6 — Resource heatmap ─────────────────────────────────────────

export type ResourceHeatmapRow = {
  weekStarting: Date;
  resource: string;
  projectId: string;
  projectName: string;
  hours: number;
};

export async function resourceHeatmap(tenantId: string, weeksAhead: number = 8): Promise<ResourceHeatmapRow[]> {
  const now = new Date();
  const future = new Date();
  future.setDate(future.getDate() + weeksAhead * 7);
  const entries = await prisma.timeEntry.findMany({
    where: { project: { tenantId }, weekEnding: { gte: now, lte: future } },
    include: { project: true },
  });
  return entries.map((t) => ({
    weekStarting: t.weekEnding,
    resource: t.employeeName,
    projectId: t.projectId,
    projectName: t.project.name,
    hours: (t.regularHours ?? 0) + (t.overtimeHours ?? 0) + (t.doubleTimeHours ?? 0),
  }));
}

// ─── R7 — Bonding / surety ─────────────────────────────────────────

export type BondingRow = {
  totalContractValue: number;
  totalCostsToDate: number;
  totalBilledToDate: number;
  workInProgress: number;
  backlog: number;
};

export async function bondingCapacityReport(tenantId: string): Promise<BondingRow> {
  const snapshots = await prisma.projectPnlSnapshot.findMany({
    where: { project: { tenantId } },
    orderBy: [{ projectId: "asc" }, { asOf: "desc" }],
    distinct: ["projectId"],
  });
  const contract = sumMoney(snapshots.map((s) => s.totalContractValue));
  const cost = sumMoney(snapshots.map((s) => s.costsToDate));
  const billed = sumMoney(snapshots.map((s) => s.billedToDate));
  return {
    totalContractValue: contract,
    totalCostsToDate: cost,
    totalBilledToDate: billed,
    workInProgress: subtractMoney(cost, billed),
    backlog: subtractMoney(contract, billed),
  };
}
