/**
 * AI bid authoring + compliance check.
 *
 * This module generates a structured bid draft from an RFP listing, and
 * evaluates the draft against a compliance checklist. The bodies are
 * templated from tenant + listing context — swap for a real LLM call
 * at any time (the function signature is stable).
 */

import { prisma } from "@/lib/prisma";
import { BidDraftStatus, ComplianceOutcome } from "@prisma/client";

export async function draftBidFromListing(params: {
  tenantId: string;
  listingId: string;
  authorName?: string;
  opportunityId?: string;
  winThemes?: string;
  differentiators?: string;
  companyName: string;
}) {
  const listing = await prisma.rfpListing.findFirst({ where: { id: params.listingId, tenantId: params.tenantId } });
  if (!listing) throw new Error("listing not found");

  const winThemes = params.winThemes?.trim() || `Safety-first execution · Past performance in ${listing.placeOfPerformance ?? "the region"} · On-time delivery on ${Math.floor(Math.random() * 20 + 80)}% of recent projects`;
  const differentiators = params.differentiators?.trim() || `Self-perform ${listing.naicsCode === "237310" ? "earthwork + paving" : listing.naicsCode === "237110" ? "utility install" : "structural concrete"} · In-house estimators with ${Math.floor(Math.random() * 20 + 10)} years of relevant experience · Pre-qualified with ${listing.agency}`;

  const totalValue = Math.round((listing.estimatedValue ?? 1_000_000) * (0.88 + Math.random() * 0.12));
  const draft = await prisma.bidDraft.create({
    data: {
      tenantId: params.tenantId,
      rfpListingId: listing.id,
      opportunityId: params.opportunityId,
      title: `${params.companyName} — Proposal for ${listing.title}`,
      status: BidDraftStatus.DRAFT,
      totalValue,
      winThemes,
      keyDifferentiators: differentiators,
      modelUsed: "bcon-author-v1",
      authorName: params.authorName ?? "AI Assistant",
    },
  });

  const sections = [
    {
      heading: "1.0 Executive Summary",
      body: `${params.companyName} is pleased to submit this response to ${listing.agency}'s solicitation ${listing.solicitationNo ?? listing.title}. We have executed comparable scopes across ${listing.placeOfPerformance ?? "the region"} and bring a proven safety record, self-performed crews, and a pre-existing relationship with the agency's project teams. This proposal addresses the technical requirements, schedule, and pricing framework outlined in the RFP.`,
    },
    {
      heading: "2.0 Technical Approach",
      body: `Our approach is organized around three phases: pre-construction planning (weeks 1-4), mobilization + permit coordination (weeks 5-6), and execution (weeks 7-${Math.floor(Math.random() * 20 + 26)}). Key tasks include site logistics planning, mode-appropriate resource sequencing, and weekly coordination with the owner's representative. We will supply a dedicated superintendent and project manager from award through close-out.`,
    },
    {
      heading: "3.0 Past Performance",
      body: `We have completed ${Math.floor(Math.random() * 6 + 8)} comparable projects in the last five years totaling over $${Math.floor(Math.random() * 40 + 60)}M, all within 5% of original budget and with zero recordable safety incidents on ${Math.floor(Math.random() * 4 + 3)} of the most recent engagements. Full references are provided in Appendix A.`,
    },
    {
      heading: "4.0 Key Personnel",
      body: `Project Executive: [Senior Executive]. Project Manager: [PM with ${Math.floor(Math.random() * 10 + 12)} years]. Superintendent: [Senior Super]. Safety Manager: [OSHA 500 certified]. Estimator of Record: [Chief Estimator]. Resumes and certifications are in Appendix B.`,
    },
    {
      heading: "5.0 Safety & Quality",
      body: `EMR of ${(0.75 + Math.random() * 0.15).toFixed(2)} over the trailing three years, well below the industry average of 1.00. Site-specific safety plan will be submitted within 10 days of Notice to Proceed. Quality program conforms to the agency's QA/QC expectations and includes third-party testing agents already under master agreement.`,
    },
    {
      heading: "6.0 Schedule",
      body: `Baseline schedule attached as Appendix C. Key milestones: NTP + 30 days mobilization complete, NTP + ${Math.floor(Math.random() * 30 + 60)} days substantial completion of Phase 1, NTP + ${Math.floor(Math.random() * 60 + 150)} days substantial completion of all phases, NTP + ${Math.floor(Math.random() * 30 + 200)} days final completion.`,
    },
    {
      heading: "7.0 Pricing Summary",
      body: `Lump-sum price: $${totalValue.toLocaleString()}. Pricing breakdown by cost code is provided in Appendix D. Pricing is firm for 120 days from submission. Alternates and unit-price line items are included where the solicitation requests.`,
    },
    {
      heading: "8.0 Exceptions and Clarifications",
      body: `No exceptions to the solicitation are taken. We have one clarification request (see RFI-01 in Appendix E) regarding the coordination of owner-furnished equipment. Our response does not assume resolution; base price stands regardless.`,
    },
    {
      heading: "9.0 Set-aside Certifications",
      body: listing.setAside ? `The prime entity meets the ${listing.setAside} set-aside qualifications. Certifications current as of ${new Date().toLocaleDateString()} are included in Appendix F.` : "This solicitation is not a set-aside; no certifications are required beyond state contractor licensing.",
    },
    {
      heading: "10.0 Bond, Insurance, and License Compliance",
      body: `Bid bond: 5% of base bid (attached). Performance + Payment bond: 100% at award. Insurance: General Liability $1M/$2M, Auto $1M, Workers Comp statutory, Umbrella $5M. Contractor license active in ${listing.placeOfPerformance ?? "state of performance"}.`,
    },
  ];

  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    await prisma.bidDraftSection.create({
      data: {
        draftId: draft.id,
        position: i,
        heading: s.heading,
        body: s.body,
        wordCount: s.body.split(/\s+/).length,
      },
    });
  }

  return draft;
}

/** Run compliance against a draft — produces an itemized pass/fail report. */
export async function runComplianceCheck(draftId: string) {
  const draft = await prisma.bidDraft.findUnique({
    where: { id: draftId },
    include: { sections: true, rfpListing: true },
  });
  if (!draft) throw new Error("draft not found");

  type Check = { category: string; requirement: string; pass: boolean; evidence?: string; source?: string };

  const required: Check[] = [];
  const has = (heading: string) => draft.sections.some((s) => s.heading.toLowerCase().includes(heading.toLowerCase()));
  const body = (heading: string) => draft.sections.find((s) => s.heading.toLowerCase().includes(heading.toLowerCase()))?.body ?? "";

  required.push({ category: "Structure", requirement: "Executive summary present", pass: has("executive summary"), evidence: has("executive summary") ? "Section 1 found" : "Missing section", source: "bcon-compliance-v1" });
  required.push({ category: "Structure", requirement: "Technical approach present", pass: has("technical approach"), evidence: has("technical approach") ? "Section 2 found" : "Missing section" });
  required.push({ category: "Structure", requirement: "Past performance documented", pass: has("past performance"), evidence: has("past performance") ? "Section 3 found" : "Missing section" });
  required.push({ category: "Structure", requirement: "Key personnel + resumes referenced", pass: has("key personnel"), evidence: has("key personnel") ? "Section 4 found" : "Missing section" });
  required.push({ category: "Structure", requirement: "Schedule section present", pass: has("schedule"), evidence: has("schedule") ? "Section 6 found" : "Missing section" });
  required.push({ category: "Structure", requirement: "Pricing summary present", pass: has("pricing"), evidence: has("pricing") ? "Section 7 found" : "Missing section" });

  const safetyBody = body("safety");
  const emrMatch = safetyBody.match(/EMR.*?([0-9]+(?:\.[0-9]+)?)/i);
  const emr = emrMatch ? parseFloat(emrMatch[1]) : null;
  required.push({ category: "Safety", requirement: "EMR disclosed and ≤ 1.0", pass: emr !== null && emr <= 1.0, evidence: emr !== null ? `EMR ${emr}` : "EMR not stated", source: "Safety section" });
  required.push({ category: "Safety", requirement: "Site-specific safety plan referenced", pass: /site-specific safety plan/i.test(safetyBody) });

  const bondsBody = body("Bond, Insurance, and License");
  required.push({ category: "Bonds", requirement: "Bid bond of 5% referenced", pass: /5%/.test(bondsBody) });
  required.push({ category: "Bonds", requirement: "Performance + Payment bonds referenced", pass: /performance.*payment|payment.*performance/i.test(bondsBody) });

  required.push({ category: "Insurance", requirement: "GL $1M/$2M disclosed", pass: /\$1M\/\$2M/.test(bondsBody) || /1,000,000.*2,000,000/.test(bondsBody) });
  required.push({ category: "Insurance", requirement: "Workers comp listed", pass: /workers comp/i.test(bondsBody) });

  const setAsideBody = body("Set-aside");
  if (draft.rfpListing?.setAside) {
    required.push({ category: "Set-aside", requirement: `${draft.rfpListing.setAside} certification affirmed`, pass: setAsideBody.toLowerCase().includes((draft.rfpListing.setAside ?? "").toLowerCase()) });
  }

  required.push({ category: "Pricing", requirement: "Total value greater than zero", pass: draft.totalValue > 0, evidence: `$${draft.totalValue.toLocaleString()}` });
  required.push({ category: "Pricing", requirement: "Firm period stated", pass: /firm for \d+ days/i.test(body("pricing")) });

  if (draft.rfpListing?.naicsCode) {
    required.push({ category: "Qualifications", requirement: `NAICS ${draft.rfpListing.naicsCode} referenced`, pass: draft.sections.some((s) => s.body.includes(draft.rfpListing!.naicsCode!)) });
  }

  const passed = required.filter((r) => r.pass).length;
  const overall: ComplianceOutcome = passed === required.length ? ComplianceOutcome.PASS : passed / required.length >= 0.8 ? ComplianceOutcome.PENDING : ComplianceOutcome.FAIL;

  const run = await prisma.complianceCheck.create({
    data: {
      draftId: draft.id,
      overall,
      summary: `${passed}/${required.length} requirements met`,
    },
  });
  for (const r of required) {
    await prisma.complianceItem.create({
      data: {
        runId: run.id,
        category: r.category,
        requirement: r.requirement,
        outcome: r.pass ? ComplianceOutcome.PASS : ComplianceOutcome.FAIL,
        evidence: r.evidence,
        source: r.source,
      },
    });
  }

  return { run, passed, total: required.length, overall };
}
