import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireManager } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { publicRedirect } from "@/lib/redirect";
import { parseNumberField, parseStringField } from "@/lib/form-input";

/**
 * Upsert the tenant's bid-matching profile. Used by the scoring engine
 * to assign 0-100 scores to incoming RfpListings and decide which
 * listings cross the auto-draft threshold.
 *
 * Most fields are comma- or newline-separated strings on the form;
 * stored as JSON arrays. Numeric fields support null (cleared).
 */
function parseList(raw: FormDataEntryValue | null): string[] {
  if (!raw) return [];
  return String(raw)
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function POST(req: Request) {
  const tenant = await requireTenant();
  const actor = await requireManager(tenant.id);
  const form = await req.formData();

  const targetNaics = parseList(form.get("targetNaics"));
  const qualifiedSetAsides = parseList(form.get("qualifiedSetAsides")).map((s) => s.toUpperCase());
  const targetStates = parseList(form.get("targetStates")).map((s) => s.toUpperCase());
  const targetCities = parseList(form.get("targetCities"));
  const boostKeywords = parseList(form.get("boostKeywords"));
  const blockKeywords = parseList(form.get("blockKeywords"));
  const preferredTiers = parseList(form.get("preferredTiers")).map((s) => s.toUpperCase());

  const minValue = parseNumberField(form.get("minValue"), null, { min: 0 });
  const maxValue = parseNumberField(form.get("maxValue"), null, { min: 0 });
  const hotThreshold = parseNumberField(form.get("hotThreshold"), 70, { min: 0, max: 100 }) ?? 70;
  const notes = parseStringField(form.get("notes"), null);

  const data = {
    targetNaicsJson: JSON.stringify(targetNaics),
    qualifiedSetAsidesJson: JSON.stringify(qualifiedSetAsides),
    targetStatesJson: JSON.stringify(targetStates),
    targetCitiesJson: JSON.stringify(targetCities),
    minValue,
    maxValue,
    boostKeywordsJson: JSON.stringify(boostKeywords),
    blockKeywordsJson: JSON.stringify(blockKeywords),
    preferredTiersJson: JSON.stringify(preferredTiers),
    hotThreshold,
    notes,
  };

  const profile = await prisma.tenantBidProfile.upsert({
    where: { tenantId: tenant.id },
    create: { tenantId: tenant.id, ...data },
    update: data,
  });

  await recordAudit({
    tenantId: tenant.id,
    actorId: actor.userId,
    actorName: actor.userName,
    entityType: "TenantBidProfile",
    entityId: profile.id,
    action: "EDIT",
    after: { hotThreshold, naicsCount: targetNaics.length, setAsides: qualifiedSetAsides, states: targetStates },
    source: "bid-profile/save",
  });

  return publicRedirect(req, "/bids/profile", 303);
}
