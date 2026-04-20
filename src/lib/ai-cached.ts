/**
 * Thin wrappers that persist results of the most-used AI features to `AiRunLog`.
 * Keep calling the base functions elsewhere for one-off reads; call these
 * variants when you want a `runId` for feedback capture + caching.
 */

import { pricingAdvisor, scoreRfpListing } from "@/lib/sales-ai";
import { eacForecast } from "@/lib/finance-ai";
import { winProbability } from "@/lib/client-ai";
import { tenantAskAnything } from "@/lib/copilot-ai";
import { prisma } from "@/lib/prisma";
import { stableHash } from "@/lib/ai";

async function logRun(tenantId: string, kind: string, inputHash: string, entityType: string | null, entityId: string | null, result: unknown): Promise<string> {
  const log = await prisma.aiRunLog.create({
    data: {
      tenantId,
      kind,
      inputHash,
      entityType: entityType ?? undefined,
      entityId: entityId ?? undefined,
      outputJson: JSON.stringify(result),
      source: "heuristic",
    },
  });
  return log.id;
}

export async function pricingAdvisorLogged(tenantId: string, draftId: string) {
  const result = await pricingAdvisor(draftId);
  const runId = await logRun(tenantId, "pricing-advisor", stableHash(draftId).toString(36), "BidDraft", draftId, result);
  return { result, runId };
}

export async function eacForecastLogged(tenantId: string, projectId: string) {
  const result = await eacForecast(projectId, tenantId);
  const runId = await logRun(tenantId, "eac-forecast", stableHash(projectId + Math.floor(Date.now() / 3_600_000)).toString(36), "Project", projectId, result);
  return { result, runId };
}

export async function winProbabilityLogged(tenantId: string, opportunityId: string) {
  const result = await winProbability(opportunityId, tenantId);
  const runId = await logRun(tenantId, "win-prob", stableHash(opportunityId).toString(36), "Opportunity", opportunityId, result);
  return { result, runId };
}

export async function scoreRfpListingLogged(tenantId: string, listingId: string) {
  const result = await scoreRfpListing(tenantId, listingId);
  const runId = await logRun(tenantId, "rfp-score", stableHash(listingId).toString(36), "RfpListing", listingId, result);
  return { result, runId };
}

export async function tenantAskAnythingLogged(tenantId: string, question: string) {
  const result = await tenantAskAnything(question, tenantId);
  const runId = await logRun(tenantId, "tenant-chat", stableHash(question).toString(36), null, null, result);
  return { result, runId };
}
