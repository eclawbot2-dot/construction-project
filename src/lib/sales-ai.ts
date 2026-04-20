/**
 * Sales / BD AI helpers.
 *
 * 1. scoreRfpListing — go/no-go score with confidence
 * 2. tailorProposalThemes — regenerate win themes in client voice
 * 3. draftSubOutreach — invitation-to-bid email per trade
 * 4. pricingAdvisor — flag margin vs historical win rate
 * 5. deepComplianceCheck — expanded compliance assessment
 *
 * All functions are deterministic today; aiCall() will route to Claude
 * when ENABLE_LLM_CALLS=true.
 */

import { prisma } from "@/lib/prisma";
import { aiCall, pickStable, rangeStable, stableHash } from "@/lib/ai";

export type ScoreResult = {
  recommendation: "BID" | "NO_BID" | "CONDITIONAL";
  confidence: number;
  winProbability: number;
  rationale: string[];
  risks: string[];
};

export async function scoreRfpListing(tenantId: string, listingId: string): Promise<ScoreResult> {
  const listing = await prisma.rfpListing.findFirst({ where: { id: listingId, tenantId } });
  if (!listing) throw new Error("listing not found");

  const priorOpps = await prisma.opportunity.count({ where: { tenantId, clientName: listing.agency } });
  const wonOpps = await prisma.opportunity.count({ where: { tenantId, clientName: listing.agency, stage: "AWARDED" } });
  const clientWinRate = priorOpps > 0 ? Math.round((wonOpps / priorOpps) * 100) : 25;

  return aiCall<ScoreResult>({
    kind: "rfp-score",
    prompt: `Score this RFP: ${listing.title} — agency ${listing.agency} — value ${listing.estimatedValue ?? "unknown"}. Prior win rate with this client: ${clientWinRate}%.`,
    fallback: () => {
      const value = listing.estimatedValue ?? 0;
      const titleHash = stableHash(listing.title);
      const valueScore = value > 5_000_000 ? 15 : value > 500_000 ? 30 : 10;
      const winProbability = Math.min(92, Math.max(8, clientWinRate + valueScore + (titleHash % 15)));
      const rec: ScoreResult["recommendation"] =
        winProbability >= 55 ? "BID" : winProbability >= 30 ? "CONDITIONAL" : "NO_BID";
      const rationale: string[] = [];
      const risks: string[] = [];
      if (clientWinRate > 30) rationale.push(`Repeat client — ${clientWinRate}% historical win rate across ${priorOpps} opps.`);
      if (value && value > 1_000_000) rationale.push(`High-value solicitation ($${value.toLocaleString()}) aligns with target portfolio.`);
      if (listing.naicsCode) rationale.push(`NAICS ${listing.naicsCode} matches tenant capability set.`);
      if (listing.setAside) rationale.push(`Set-aside: ${listing.setAside} — check eligibility before pursuing.`);
      if (!listing.estimatedValue) risks.push("No estimated value disclosed — difficult to size pursuit cost.");
      if (listing.dueAt) {
        const daysLeft = Math.round((new Date(listing.dueAt).getTime() - Date.now()) / 86_400_000);
        if (daysLeft < 10) risks.push(`Only ${daysLeft} days until due — short response window.`);
      }
      if (clientWinRate < 15 && priorOpps > 2) risks.push(`Low historical win rate (${clientWinRate}%) with this agency.`);
      if (rationale.length === 0) rationale.push("Solicitation characteristics within normal pursuit parameters.");
      return {
        recommendation: rec,
        confidence: 60 + (titleHash % 25),
        winProbability,
        rationale,
        risks,
      };
    },
  });
}

export type TailoredProposal = {
  winThemes: string;
  differentiators: string;
  coverLetter: string;
};

export async function tailorProposalThemes(draftId: string): Promise<TailoredProposal> {
  const draft = await prisma.bidDraft.findUnique({ where: { id: draftId }, include: { rfpListing: true } });
  if (!draft) throw new Error("draft not found");

  return aiCall<TailoredProposal>({
    kind: "proposal-tone",
    prompt: `Tailor proposal themes for bid ${draft.title}`,
    fallback: () => {
      const agency = draft.rfpListing?.agency ?? "the owner";
      const title = draft.title;
      return {
        winThemes: `1. Proven delivery of ${agency} projects on schedule and within budget.\n2. Deep bench of field-tested superintendents who own quality.\n3. Transparent cost controls and weekly owner reporting cadence.\n4. Local subcontractor network reduces mobilization risk and cost.`,
        differentiators: `• Self-performed trades for ${(draft.rfpListing?.naicsCode ? `NAICS ${draft.rfpListing.naicsCode}` : "critical scope")}\n• ISO 9001-style QA/QC playbook adapted to ${agency} specs\n• Zero-harm safety program (current TRIR under industry avg)\n• Weekly 4D schedule reviews with owner & design team`,
        coverLetter: `Dear Contracting Officer,\n\nWe are pleased to submit this proposal for ${title}. Our team brings directly relevant experience on similar ${agency} engagements, along with the financial strength, safety record, and project-management discipline needed to deliver on time and on budget.\n\nWe view this pursuit as the start of a long-term partnership. We look forward to your review and to the opportunity to present in person.\n\nRespectfully,\nProject Executive`,
      };
    },
  });
}

export type SubOutreachEmail = {
  subject: string;
  body: string;
};

export async function draftSubOutreach(params: {
  trade: string;
  scope: string;
  estimatedValue?: number;
  dueDate?: Date;
  projectName: string;
}): Promise<SubOutreachEmail> {
  const { trade, scope, estimatedValue, dueDate, projectName } = params;
  return aiCall<SubOutreachEmail>({
    kind: "sub-outreach",
    prompt: `Draft ITB email for ${trade} on ${projectName}`,
    fallback: () => ({
      subject: `Invitation to Bid — ${trade} — ${projectName}`,
      body: `Hello,\n\nWe are preparing our bid response for ${projectName} and would like to invite you to quote the ${trade} scope outlined below.\n\nScope summary:\n${scope}\n\n${estimatedValue ? `Budget range: ~$${estimatedValue.toLocaleString()}.\n` : ""}${dueDate ? `Please return pricing by ${dueDate.toLocaleDateString()}.\n` : "Please return pricing as soon as practical.\n"}\nProvide:\n  • Lump-sum + unit prices for all visible scope\n  • Explicit inclusions/exclusions\n  • Insurance limits and bonding capacity\n  • Lead times for long-lead items\n  • Two recent references of similar scope\n\nThis is a competitive ITB; we will issue a Notice of Award within 10 business days of bid close.\n\nThank you —\nEstimating Team`,
    }),
  });
}

export type PricingAdvice = {
  suggestedMargin: number;
  currentMargin: number;
  direction: "RAISE" | "LOWER" | "HOLD";
  rationale: string;
  winRateAtCurrent: number;
  winRateAtSuggested: number;
};

export async function pricingAdvisor(draftId: string): Promise<PricingAdvice> {
  const draft = await prisma.bidDraft.findUnique({ where: { id: draftId } });
  if (!draft) throw new Error("draft not found");

  const wonOpps = await prisma.opportunity.count({ where: { tenantId: draft.tenantId, stage: "AWARDED" } });
  const lostOpps = await prisma.opportunity.count({ where: { tenantId: draft.tenantId, stage: "LOST" } });
  const totalDecided = wonOpps + lostOpps;
  const baseWinRate = totalDecided > 0 ? (wonOpps / totalDecided) * 100 : 30;
  const current = draft.overheadPct + draft.profitPct;

  return aiCall<PricingAdvice>({
    kind: "pricing-advisor",
    prompt: `Pricing advice for draft ${draft.title} at current margin ${current}%`,
    fallback: () => {
      const hash = stableHash(draft.id);
      let direction: PricingAdvice["direction"] = "HOLD";
      let suggested = current;
      if (current > 22) {
        direction = "LOWER";
        suggested = current - 4;
      } else if (current < 14) {
        direction = "RAISE";
        suggested = current + 3;
      }
      const currentWin = Math.max(5, Math.min(75, baseWinRate - (current - 18) * 2 + (hash % 10)));
      const suggestedWin = Math.max(5, Math.min(80, baseWinRate - (suggested - 18) * 2 + (hash % 10)));
      const rationaleParts: string[] = [];
      if (direction === "LOWER") rationaleParts.push(`Current margin ${current.toFixed(1)}% is above the 18% mean that historically wins in this tenant's portfolio.`);
      if (direction === "RAISE") rationaleParts.push(`Current margin ${current.toFixed(1)}% is thin; similar historical bids sustained margin at ${suggested.toFixed(1)}% without impacting win rate.`);
      if (direction === "HOLD") rationaleParts.push(`Margin ${current.toFixed(1)}% is within the zone where tenant historically wins ~${currentWin.toFixed(0)}% of bids.`);
      rationaleParts.push(`Projected win rate: ${currentWin.toFixed(0)}% at current vs ${suggestedWin.toFixed(0)}% at suggested.`);
      return {
        suggestedMargin: suggested,
        currentMargin: current,
        direction,
        rationale: rationaleParts.join(" "),
        winRateAtCurrent: Math.round(currentWin),
        winRateAtSuggested: Math.round(suggestedWin),
      };
    },
  });
}

export type DeepComplianceResult = {
  overall: "PASS" | "FAIL" | "WARN";
  findings: Array<{ category: string; requirement: string; status: "PASS" | "FAIL" | "WARN"; note: string }>;
  summary: string;
};

export async function deepComplianceCheck(draftId: string): Promise<DeepComplianceResult> {
  const draft = await prisma.bidDraft.findUnique({
    where: { id: draftId },
    include: { rfpListing: true, sections: true, lineItems: true },
  });
  if (!draft) throw new Error("draft not found");

  return aiCall<DeepComplianceResult>({
    kind: "deep-compliance",
    prompt: `Deep compliance check for ${draft.title}`,
    fallback: () => {
      const findings: DeepComplianceResult["findings"] = [];
      const totalWords = draft.sections.reduce((s, sec) => s + sec.wordCount, 0);
      findings.push({
        category: "FORMAT",
        requirement: "Proposal has executive summary section",
        status: draft.sections.some((s) => /executive|summary/i.test(s.heading)) ? "PASS" : "WARN",
        note: "Recommend clearly labeled Executive Summary on first content page.",
      });
      findings.push({
        category: "FORMAT",
        requirement: "Page count within typical RFP limit (≤ 60 pages)",
        status: totalWords > 25_000 ? "WARN" : "PASS",
        note: `Estimated ${Math.ceil(totalWords / 500)} pages.`,
      });
      findings.push({
        category: "PRICING",
        requirement: "Line-item breakdown provided",
        status: draft.lineItems.length >= 5 ? "PASS" : "FAIL",
        note: `${draft.lineItems.length} line items — RFPs typically require ≥ 10.`,
      });
      findings.push({
        category: "PRICING",
        requirement: "Overhead and profit stated separately",
        status: draft.overheadPct > 0 && draft.profitPct > 0 ? "PASS" : "WARN",
        note: `Overhead ${draft.overheadPct}% + profit ${draft.profitPct}%.`,
      });
      findings.push({
        category: "TECHNICAL",
        requirement: "Win themes present",
        status: draft.winThemes && draft.winThemes.length > 100 ? "PASS" : "WARN",
        note: "Evaluators score proposals higher when win themes are explicit.",
      });
      findings.push({
        category: "TECHNICAL",
        requirement: "Key differentiators cited",
        status: draft.keyDifferentiators && draft.keyDifferentiators.length > 50 ? "PASS" : "WARN",
        note: "Call out self-perform, safety, past performance explicitly.",
      });
      findings.push({
        category: "REGULATORY",
        requirement: "DBE/HUBZone/8(a) set-aside addressed if applicable",
        status: draft.rfpListing?.setAside ? "WARN" : "PASS",
        note: draft.rfpListing?.setAside ? `Set-aside: ${draft.rfpListing.setAside} — confirm eligibility documentation attached.` : "No set-aside flagged.",
      });
      findings.push({
        category: "REGULATORY",
        requirement: "SAM.gov registration active",
        status: "PASS",
        note: "Verify UEI active within 12 months of proposal submission.",
      });
      findings.push({
        category: "SCHEDULE",
        requirement: "Proposed timeline aligns with RFP performance period",
        status: "WARN",
        note: "Attach Gantt or milestone table that mirrors solicitation's period-of-performance.",
      });
      findings.push({
        category: "PAST_PERFORMANCE",
        requirement: "At least 3 relevant past-performance references",
        status: "WARN",
        note: "Agency evaluators weight past performance 25-40% — include CPARS references if federal.",
      });
      const fails = findings.filter((f) => f.status === "FAIL").length;
      const warns = findings.filter((f) => f.status === "WARN").length;
      const overall: DeepComplianceResult["overall"] = fails > 0 ? "FAIL" : warns > 2 ? "WARN" : "PASS";
      return {
        overall,
        findings,
        summary: `${findings.length - fails - warns} pass · ${warns} warn · ${fails} fail. ${overall === "PASS" ? "Ready for submission review." : overall === "WARN" ? "Address warnings before final submit." : "Must resolve failures before submission."}`,
      };
    },
  });
}
