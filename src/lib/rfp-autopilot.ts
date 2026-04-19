/**
 * RFP autopilot: drive a listing through the full bid pipeline in one call.
 *
 * Steps:
 *   1. Ensure an Opportunity exists (upsert-by-solicitation-number).
 *   2. Generate a bid draft (sections) via draftBidFromListing.
 *   3. Generate a line-item estimate via generateEstimateForDraft.
 *   4. Run compliance check and mark draft UNDER_REVIEW if pass.
 *
 * Also exports the tenant-wide `crawlAllSources` used by the scheduled sweep.
 */

import { prisma } from "@/lib/prisma";
import { draftBidFromListing, runComplianceCheck } from "@/lib/bid-author";
import { generateEstimateForDraft } from "@/lib/estimating";
import { crawlSourceAndPersist, modeFromListing } from "@/lib/rfp-crawl";
import { OpportunityStage, RfpSourceStatus } from "@prisma/client";

export async function autopilotListing(tenantId: string, listingId: string, companyName: string): Promise<{ ok: boolean; draftId?: string; passed?: number; total?: number; note: string }> {
  const listing = await prisma.rfpListing.findFirst({ where: { id: listingId, tenantId } });
  if (!listing) return { ok: false, note: "listing not found" };

  // Step 1 — upsert opportunity
  let oppId = listing.opportunityId;
  if (!oppId) {
    const existing = await prisma.opportunity.findFirst({
      where: { tenantId, name: { contains: listing.solicitationNo ?? listing.title.slice(0, 40) } },
    });
    const opp = existing ?? await prisma.opportunity.create({
      data: {
        tenantId,
        name: `${listing.agency} · ${listing.title}`,
        clientName: listing.agency,
        stage: OpportunityStage.PROPOSAL,
        estimatedValue: listing.estimatedValue ?? 0,
        probability: 45,
        dueDate: listing.dueAt,
        source: "autopilot",
        mode: modeFromListing({ placeOfPerformance: listing.placeOfPerformance, title: listing.title }),
      },
    });
    oppId = opp.id;
    await prisma.rfpListing.update({ where: { id: listing.id }, data: { opportunityId: oppId, status: "PURSUING" } });
  }

  // Step 2 — draft
  const draft = await draftBidFromListing({ tenantId, listingId: listing.id, companyName, opportunityId: oppId ?? undefined, authorName: "AI Autopilot" });

  // Step 3 — line-item estimate
  const estimate = await generateEstimateForDraft(draft.id);

  // Step 4 — compliance
  const compliance = await runComplianceCheck(draft.id);

  // If all pass, mark draft UNDER_REVIEW so humans see it's ready to submit.
  if (compliance.overall === "PASS") {
    await prisma.bidDraft.update({ where: { id: draft.id }, data: { status: "UNDER_REVIEW" } });
  }

  return {
    ok: true,
    draftId: draft.id,
    passed: compliance.passed,
    total: compliance.total,
    note: `Drafted ${estimate.lineItems} line items ($${estimate.total.toLocaleString()}). Compliance ${compliance.passed}/${compliance.total} — ${compliance.overall}.`,
  };
}

/** Run a sweep across every ACTIVE source in every tenant, respecting cadence. */
export async function sweepAllSources(): Promise<{ ok: boolean; sourcesChecked: number; newListings: number }> {
  const sources = await prisma.rfpSource.findMany({ where: { status: RfpSourceStatus.ACTIVE } });
  let checked = 0;
  let created = 0;
  const now = Date.now();
  for (const s of sources) {
    const cadenceMs = cadenceToMs(s.cadence);
    if (s.lastCheckedAt && now - new Date(s.lastCheckedAt).getTime() < cadenceMs) continue;
    const result = await crawlSourceAndPersist(s.id);
    checked += 1;
    created += result.created;
  }
  return { ok: true, sourcesChecked: checked, newListings: created };
}

function cadenceToMs(cadence: string): number {
  switch (cadence.toUpperCase()) {
    case "HOURLY": return 60 * 60 * 1000;
    case "DAILY": return 4 * 60 * 60 * 1000; // run at least every 4h → 6x/business-day
    case "WEEKLY": return 24 * 60 * 60 * 1000;
    default: return 4 * 60 * 60 * 1000;
  }
}
