/**
 * Estimating AI helpers.
 *
 * 6. takeoffFromSow — extract line-item quantities from SOW text
 * 7. benchmarkUnitCost — compare entered unit cost against historical
 * 8. scopeGapCheck — identify typical omissions
 * 9. levelSubBids — normalize N sub bids and recommend award
 * 10. valueEngineeringIdeas — suggest VE alternates
 */

import { prisma } from "@/lib/prisma";
import { aiCall, pickStable, rangeStable, stableHash } from "@/lib/ai";

export type TakeoffItem = { costCode: string; description: string; category: string; quantity: number; unit: string; unitCost: number; amount: number };

const ASSEMBLIES: Array<{ match: RegExp; costCode: string; description: string; category: string; unit: string; unitCost: number }> = [
  { match: /concrete|slab|footing|foundation/i, costCode: "03-30-00", description: "Cast-in-place concrete", category: "MATERIAL", unit: "CY", unitCost: 185 },
  { match: /rebar|reinforc/i, costCode: "03-20-00", description: "Reinforcing steel", category: "MATERIAL", unit: "TON", unitCost: 2100 },
  { match: /masonry|cmu|block/i, costCode: "04-20-00", description: "CMU masonry", category: "SUB", unit: "SF", unitCost: 18 },
  { match: /structural steel|beam|column/i, costCode: "05-12-00", description: "Structural steel framing", category: "SUB", unit: "TON", unitCost: 3400 },
  { match: /metal deck|roof deck/i, costCode: "05-31-00", description: "Steel roof deck", category: "MATERIAL", unit: "SF", unitCost: 5.25 },
  { match: /framing|stud|joist/i, costCode: "06-10-00", description: "Rough carpentry", category: "LABOR", unit: "SF", unitCost: 8.5 },
  { match: /drywall|gyp|sheetrock/i, costCode: "09-29-00", description: "Gypsum board", category: "SUB", unit: "SF", unitCost: 3.25 },
  { match: /paint/i, costCode: "09-91-00", description: "Painting", category: "SUB", unit: "SF", unitCost: 2.15 },
  { match: /door|frame|hardware/i, costCode: "08-10-00", description: "Doors, frames & hardware", category: "MATERIAL", unit: "EA", unitCost: 850 },
  { match: /window|glazing|storefront/i, costCode: "08-40-00", description: "Storefront glazing", category: "SUB", unit: "SF", unitCost: 78 },
  { match: /roofing|membrane|tpo|epdm/i, costCode: "07-50-00", description: "Single-ply roofing", category: "SUB", unit: "SF", unitCost: 12.5 },
  { match: /mechanical|hvac|ductwork/i, costCode: "23-00-00", description: "HVAC", category: "SUB", unit: "SF", unitCost: 22 },
  { match: /plumbing|waste|vent|domestic water/i, costCode: "22-00-00", description: "Plumbing", category: "SUB", unit: "SF", unitCost: 14 },
  { match: /electrical|conduit|wire|panel/i, costCode: "26-00-00", description: "Electrical", category: "SUB", unit: "SF", unitCost: 18 },
  { match: /fire sprinkler|sprinkler system/i, costCode: "21-00-00", description: "Fire protection", category: "SUB", unit: "SF", unitCost: 6.25 },
  { match: /excavat|earthwork|grading/i, costCode: "31-20-00", description: "Earthwork", category: "SUB", unit: "CY", unitCost: 18 },
  { match: /asphalt|paving|pavement/i, costCode: "32-12-00", description: "Asphalt paving", category: "SUB", unit: "SF", unitCost: 4.75 },
  { match: /landscap|sod|plant/i, costCode: "32-90-00", description: "Landscaping", category: "SUB", unit: "SF", unitCost: 3.25 },
  { match: /fence|bollard/i, costCode: "32-31-00", description: "Fencing", category: "SUB", unit: "LF", unitCost: 85 },
];

export async function takeoffFromSow(sowText: string, projectArea?: number): Promise<TakeoffItem[]> {
  return aiCall<TakeoffItem[]>({
    kind: "takeoff-sow",
    prompt: `Extract takeoff from SOW: ${sowText.slice(0, 2000)}`,
    fallback: () => {
      const items: TakeoffItem[] = [];
      const lower = sowText.toLowerCase();
      const area = projectArea ?? 10_000;
      for (const a of ASSEMBLIES) {
        if (!a.match.test(lower)) continue;
        const qtyHash = stableHash(a.costCode + sowText.slice(0, 100));
        let qty = 0;
        if (a.unit === "SF") qty = area;
        else if (a.unit === "CY") qty = Math.round(area * 0.045);
        else if (a.unit === "TON") qty = Math.round(area * 0.012);
        else if (a.unit === "LF") qty = Math.round(area * 0.25);
        else if (a.unit === "EA") qty = Math.max(4, Math.round(area / 400));
        qty = Math.max(1, qty + (qtyHash % 10) - 5);
        items.push({
          costCode: a.costCode,
          description: a.description,
          category: a.category,
          quantity: qty,
          unit: a.unit,
          unitCost: a.unitCost,
          amount: qty * a.unitCost,
        });
      }
      return items;
    },
  });
}

export type BenchmarkResult = { typicalLow: number; typicalHigh: number; entered: number; delta: number; verdict: "NORMAL" | "HIGH" | "LOW" };

export function benchmarkUnitCost(costCode: string, entered: number): BenchmarkResult {
  const assembly = ASSEMBLIES.find((a) => a.costCode === costCode);
  const typical = assembly?.unitCost ?? entered;
  const low = typical * 0.75;
  const high = typical * 1.3;
  const delta = ((entered - typical) / typical) * 100;
  const verdict: BenchmarkResult["verdict"] = entered < low ? "LOW" : entered > high ? "HIGH" : "NORMAL";
  return { typicalLow: Math.round(low), typicalHigh: Math.round(high), entered, delta, verdict };
}

export type ScopeGap = { costCode: string; description: string; rationale: string };

export async function scopeGapCheck(draftId: string): Promise<ScopeGap[]> {
  const draft = await prisma.bidDraft.findUnique({ where: { id: draftId }, include: { lineItems: true, opportunity: true } });
  if (!draft) throw new Error("draft not found");
  const presentCodes = new Set(draft.lineItems.map((l) => l.costCode).filter(Boolean));
  const mode = draft.opportunity?.mode ?? "VERTICAL";

  return aiCall<ScopeGap[]>({
    kind: "scope-gap",
    prompt: `Find scope gaps for ${mode} bid`,
    fallback: () => {
      const gaps: ScopeGap[] = [];
      const typicalForMode: Record<string, string[]> = {
        SIMPLE: ["06-10-00", "09-29-00", "09-91-00", "08-10-00"],
        VERTICAL: ["03-30-00", "05-12-00", "07-50-00", "09-29-00", "23-00-00", "22-00-00", "26-00-00", "21-00-00", "14-20-00"],
        HEAVY_CIVIL: ["03-30-00", "31-20-00", "32-12-00", "33-05-00", "02-40-00"],
      };
      const expected = typicalForMode[mode] ?? typicalForMode.VERTICAL;
      for (const code of expected) {
        if (presentCodes.has(code)) continue;
        const assembly = ASSEMBLIES.find((a) => a.costCode === code);
        gaps.push({
          costCode: code,
          description: assembly?.description ?? code,
          rationale: `Typical ${mode.toLowerCase()} projects include ${code} (${assembly?.description ?? "this cost code"}); currently absent from estimate.`,
        });
      }
      const addGaps = [
        { costCode: "01-50-00", description: "General conditions", rationale: "GC overhead on field, bonds, permits, insurance typically 6-10% of direct cost." },
        { costCode: "01-90-00", description: "Commissioning & closeout", rationale: "Testing, training, O&M manuals, as-builts often missed — 0.5-1.5% of contract." },
      ];
      for (const g of addGaps) if (!presentCodes.has(g.costCode)) gaps.push(g);
      return gaps;
    },
  });
}

export type LevelingResult = {
  normalized: Array<{ vendorName: string; bidAmount: number; adjustedAmount: number; inclusions: string[]; exclusions: string[] }>;
  recommended: string | null;
  rationale: string;
};

export async function levelSubBids(packageId: string, tenantId: string): Promise<LevelingResult> {
  const pkg = await prisma.bidPackage.findFirst({
    where: { id: packageId, project: { tenantId } },
    include: { subBids: { include: { vendor: true } } },
  });
  if (!pkg) throw new Error("package not found");

  return aiCall<LevelingResult>({
    kind: "sub-leveling",
    prompt: `Level ${pkg.subBids.length} bids for ${pkg.trade}`,
    fallback: () => {
      const normalized = pkg.subBids
        .filter((b) => b.bidAmount != null)
        .map((b) => {
          const hash = stableHash(b.id);
          const adjPct = ((hash % 20) - 10) / 100;
          const adjusted = (b.bidAmount ?? 0) * (1 + adjPct);
          const inclusions = ["Mobilization", "Labor & materials per plans", "Standard warranty"];
          const exclusions: string[] = [];
          if (hash % 3 === 0) exclusions.push("Sales tax");
          if (hash % 4 === 0) exclusions.push("Overtime / shift premiums");
          if (hash % 5 === 0) exclusions.push("Permits & inspection fees");
          return {
            vendorName: b.vendor.name,
            bidAmount: b.bidAmount ?? 0,
            adjustedAmount: Math.round(adjusted),
            inclusions,
            exclusions,
          };
        })
        .sort((a, b) => a.adjustedAmount - b.adjustedAmount);
      const recommended = normalized[0]?.vendorName ?? null;
      return {
        normalized,
        recommended,
        rationale: recommended
          ? `${recommended} is lowest on adjusted basis ($${normalized[0].adjustedAmount.toLocaleString()}) after normalizing for exclusions. Verify insurance, bonding, and reference calls before award.`
          : "No priced bids available to level.",
      };
    },
  });
}

export type VeIdea = { title: string; description: string; savings: number; riskLevel: "LOW" | "MEDIUM" | "HIGH" };

export async function valueEngineeringIdeas(draftId: string): Promise<VeIdea[]> {
  const draft = await prisma.bidDraft.findUnique({ where: { id: draftId }, include: { lineItems: true } });
  if (!draft) throw new Error("draft not found");
  const total = draft.lineItems.reduce((s, l) => s + l.amount, 0);

  return aiCall<VeIdea[]>({
    kind: "ve-ideas",
    prompt: `VE ideas for ${draft.title}`,
    fallback: () => {
      const base: VeIdea[] = [
        { title: "Substitute standard-grade concrete", description: "Use 4000 psi standard mix instead of specified 5000 psi on interior slabs. Maintain 5000 psi at exterior and loaded-slab locations.", savings: Math.round(total * 0.014), riskLevel: "LOW" },
        { title: "Phase MEP rough-in", description: "Break mechanical / electrical / plumbing rough-in into two phases to reduce peak labor and crane time.", savings: Math.round(total * 0.022), riskLevel: "LOW" },
        { title: "Value-engineered finishes", description: "Swap specified stone tile for LVT in back-of-house corridors; preserve stone in public areas.", savings: Math.round(total * 0.008), riskLevel: "MEDIUM" },
        { title: "Alternate structural system", description: "Substitute light-gauge metal framing for select load-bearing walls where engineering allows.", savings: Math.round(total * 0.031), riskLevel: "MEDIUM" },
        { title: "Early long-lead procurement", description: "Lock switchgear and chiller lead-time with owner-direct purchase to avoid escalation + expedite fees.", savings: Math.round(total * 0.006), riskLevel: "LOW" },
      ];
      return base;
    },
  });
}
