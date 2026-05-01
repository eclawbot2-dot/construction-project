/**
 * Listing match scoring.
 *
 * Computes a 0-100 score for an RfpListing against a tenant's
 * TenantBidProfile. The signal weights are calibrated for construction
 * GCs / subs pursuing federal + state + local work; tweak the constants
 * here to tune the model's bias.
 *
 * Each scoring signal returns a 0-1 fit value; the final score is a
 * weighted sum × 100. The breakdown is returned as scoreExplanation so
 * the UI can render "matched on NAICS + geo, partial set-aside fit"
 * tooltips and the operator can audit why a listing did or didn't
 * cross the auto-draft threshold.
 *
 * Pure function — no Prisma calls. Caller resolves the listing + profile
 * and passes them in.
 */

import type { RfpListing } from "@prisma/client";

export type BidProfile = {
  targetNaics: string[];
  qualifiedSetAsides: string[];
  targetStates: string[];
  targetCities: string[];
  minValue: number | null;
  maxValue: number | null;
  boostKeywords: string[];
  blockKeywords: string[];
  preferredTiers: string[];
  hotThreshold: number;
};

export type ListingScoreSignal = {
  name: string;
  weight: number; // 0..1; sums to ~1 across all signals
  fit: number;    // 0..1
  note?: string;
};

export type ListingScore = {
  score: number; // 0..100
  signals: ListingScoreSignal[];
  hot: boolean;
};

/** Weights — tweak here to bias the model. Sum should be ~1. */
const WEIGHTS = {
  naics: 0.25,
  setAside: 0.15,
  geo: 0.20,
  value: 0.15,
  keywords: 0.15,
  tier: 0.10,
};

export function scoreListing(listing: Pick<RfpListing, "title" | "summary" | "agency" | "agencyKind" | "agencyTier" | "naicsCode" | "setAside" | "estimatedValue" | "placeOfPerformance">, profile: BidProfile): ListingScore {
  const signals: ListingScoreSignal[] = [];

  // 1. NAICS match.
  const listingNaics = (listing.naicsCode ?? "").trim();
  const naicsFit = listingNaics
    ? profile.targetNaics.some((target) => target && listingNaics.startsWith(target))
      ? 1
      : profile.targetNaics.length === 0
        ? 0.5 // no preference set → neutral
        : 0
    : 0.3; // no NAICS on listing → low confidence
  signals.push({
    name: "NAICS",
    weight: WEIGHTS.naics,
    fit: naicsFit,
    note: listingNaics ? `listing ${listingNaics} vs profile ${profile.targetNaics.join(",") || "(none set)"}` : "no NAICS on listing",
  });

  // 2. Set-aside qualification.
  const listingSetAside = (listing.setAside ?? "").trim().toUpperCase();
  const setAsideFit = !listingSetAside
    ? 0.7 // unrestricted is fine, just less of a head-start
    : profile.qualifiedSetAsides.some((s) => s.toUpperCase() === listingSetAside)
      ? 1
      : 0; // restricted to a set-aside the tenant doesn't hold → not a fit
  signals.push({
    name: "Set-aside",
    weight: WEIGHTS.setAside,
    fit: setAsideFit,
    note: listingSetAside ? `listing ${listingSetAside} vs qualified ${profile.qualifiedSetAsides.join(",") || "(none)"}` : "unrestricted",
  });

  // 3. Geographic fit. State match > 0.7; city match > 0.95.
  const place = (listing.placeOfPerformance ?? "").toLowerCase();
  let geoFit: number;
  let geoNote: string;
  if (profile.targetStates.length === 0 && profile.targetCities.length === 0) {
    geoFit = 0.5;
    geoNote = "no geo preference";
  } else {
    const cityHit = profile.targetCities.some((c) => c && place.includes(c.toLowerCase()));
    const stateHit = profile.targetStates.some((s) => s && place.toUpperCase().includes(`, ${s.toUpperCase()}`));
    geoFit = cityHit ? 1 : stateHit ? 0.8 : 0.2;
    geoNote = `place=${listing.placeOfPerformance ?? "?"} → city=${cityHit} state=${stateHit}`;
  }
  signals.push({ name: "Geography", weight: WEIGHTS.geo, fit: geoFit, note: geoNote });

  // 4. Value fit — within range = 1, just outside = 0.6, way out = 0.2.
  const value = listing.estimatedValue ?? null;
  let valueFit: number;
  let valueNote: string;
  if (value == null) {
    valueFit = 0.5;
    valueNote = "no estimated value";
  } else if (profile.minValue == null && profile.maxValue == null) {
    valueFit = 0.5;
    valueNote = "no value range set";
  } else {
    const tooSmall = profile.minValue != null && value < profile.minValue;
    const tooLarge = profile.maxValue != null && value > profile.maxValue;
    if (!tooSmall && !tooLarge) {
      valueFit = 1;
      valueNote = `$${formatM(value)} within range`;
    } else if (tooSmall && profile.minValue && value > profile.minValue * 0.5) {
      valueFit = 0.6;
      valueNote = `$${formatM(value)} below min $${formatM(profile.minValue)} (close)`;
    } else if (tooLarge && profile.maxValue && value < profile.maxValue * 2) {
      valueFit = 0.6;
      valueNote = `$${formatM(value)} above max $${formatM(profile.maxValue)} (close)`;
    } else {
      valueFit = 0.2;
      valueNote = `$${formatM(value)} far from [${profile.minValue ? `$${formatM(profile.minValue)}` : "any"}, ${profile.maxValue ? `$${formatM(profile.maxValue)}` : "any"}]`;
    }
  }
  signals.push({ name: "Value", weight: WEIGHTS.value, fit: valueFit, note: valueNote });

  // 5. Keyword boosts and blocks.
  const text = `${listing.title} ${listing.summary ?? ""}`.toLowerCase();
  const blockHit = profile.blockKeywords.find((k) => k && text.includes(k.toLowerCase()));
  const boostHits = profile.boostKeywords.filter((k) => k && text.includes(k.toLowerCase())).length;
  let kwFit: number;
  let kwNote: string;
  if (blockHit) {
    kwFit = 0;
    kwNote = `blocked by "${blockHit}"`;
  } else if (profile.boostKeywords.length === 0) {
    kwFit = 0.5;
    kwNote = "no boost keywords";
  } else if (boostHits === 0) {
    kwFit = 0.4;
    kwNote = "no boost keywords matched";
  } else {
    kwFit = Math.min(1, 0.5 + boostHits * 0.2);
    kwNote = `${boostHits} boost keyword${boostHits === 1 ? "" : "s"} matched`;
  }
  signals.push({ name: "Keywords", weight: WEIGHTS.keywords, fit: kwFit, note: kwNote });

  // 6. Agency tier preference.
  const tier = listing.agencyTier ?? null;
  let tierFit: number;
  let tierNote: string;
  if (profile.preferredTiers.length === 0) {
    tierFit = 0.5;
    tierNote = "no tier preference";
  } else if (!tier) {
    tierFit = 0.4;
    tierNote = "tier unknown on listing";
  } else if (profile.preferredTiers.includes(tier)) {
    tierFit = 1;
    tierNote = `tier ${tier} preferred`;
  } else {
    tierFit = 0.2;
    tierNote = `tier ${tier} not preferred`;
  }
  signals.push({ name: "Agency tier", weight: WEIGHTS.tier, fit: tierFit, note: tierNote });

  const totalWeight = signals.reduce((s, x) => s + x.weight, 0);
  const weightedSum = signals.reduce((s, x) => s + x.weight * x.fit, 0);
  const score = Math.round((weightedSum / totalWeight) * 100);

  return { score, signals, hot: score >= profile.hotThreshold };
}

function formatM(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return `${n}`;
}

/** Default profile for a tenant that hasn't customized. Provides
 *  reasonable middle-of-the-road fits so scoring still surfaces useful
 *  rankings the moment a tenant subscribes to a source. */
export function defaultProfile(): BidProfile {
  return {
    targetNaics: [],
    qualifiedSetAsides: [],
    targetStates: [],
    targetCities: [],
    minValue: null,
    maxValue: null,
    boostKeywords: [],
    blockKeywords: [],
    preferredTiers: [],
    hotThreshold: 70,
  };
}
