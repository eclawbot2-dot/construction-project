import { describe, it, expect } from "vitest";
import { scoreListing, defaultProfile } from "../src/lib/listing-score";

const baseListing = {
  title: "Highway resurfacing project",
  summary: "Asphalt resurfacing on I-40",
  agency: "NCDOT",
  agencyKind: "STATE" as const,
  agencyTier: "TRANSPORTATION" as const,
  naicsCode: "237310",
  setAside: null,
  estimatedValue: 5_000_000,
  placeOfPerformance: null,
};

describe("scoreListing — geo state matching", () => {
  it("matches 2-letter abbreviation when preceded by comma", () => {
    const r = scoreListing(
      { ...baseListing, placeOfPerformance: "Raleigh, NC" },
      { ...defaultProfile(), targetStates: ["NC"] }
    );
    const geo = r.signals.find((s) => s.name === "Geography")!;
    expect(geo.fit).toBeGreaterThanOrEqual(0.8);
  });

  it("matches full state name regardless of case", () => {
    const r = scoreListing(
      { ...baseListing, placeOfPerformance: "Charlotte, NORTH CAROLINA" },
      { ...defaultProfile(), targetStates: ["NC"] }
    );
    const geo = r.signals.find((s) => s.name === "Geography")!;
    expect(geo.fit).toBeGreaterThanOrEqual(0.8);
  });

  it("matches when profile uses full name and listing uses abbreviation", () => {
    const r = scoreListing(
      { ...baseListing, placeOfPerformance: "Raleigh, NC" },
      { ...defaultProfile(), targetStates: ["North Carolina"] }
    );
    const geo = r.signals.find((s) => s.name === "Geography")!;
    expect(geo.fit).toBeGreaterThanOrEqual(0.8);
  });

  it("does NOT match abbreviation embedded in unrelated word", () => {
    // "Sync" contains "nc" but isn't a state reference.
    const r = scoreListing(
      { ...baseListing, placeOfPerformance: "Sync, FL" },
      { ...defaultProfile(), targetStates: ["NC"] }
    );
    const geo = r.signals.find((s) => s.name === "Geography")!;
    expect(geo.fit).toBeLessThan(0.5);
  });

  it("returns low fit when no state matches", () => {
    const r = scoreListing(
      { ...baseListing, placeOfPerformance: "Phoenix, AZ" },
      { ...defaultProfile(), targetStates: ["NC", "SC"] }
    );
    const geo = r.signals.find((s) => s.name === "Geography")!;
    expect(geo.fit).toBe(0.2);
  });

  it("city match beats state match", () => {
    const r = scoreListing(
      { ...baseListing, placeOfPerformance: "Raleigh, NC" },
      { ...defaultProfile(), targetCities: ["Raleigh"], targetStates: ["NC"] }
    );
    const geo = r.signals.find((s) => s.name === "Geography")!;
    expect(geo.fit).toBe(1);
  });
});

describe("scoreListing — block keyword cap", () => {
  it("caps the score at 25 when a block keyword fires, even with strong other signals", () => {
    const profile = {
      ...defaultProfile(),
      targetNaics: ["237310"],
      targetStates: ["NC"],
      minValue: 1_000_000,
      maxValue: 10_000_000,
      preferredTiers: ["TRANSPORTATION"],
      blockKeywords: ["asphalt"],
    };
    const r = scoreListing(
      { ...baseListing, placeOfPerformance: "Raleigh, NC" },
      profile
    );
    expect(r.score).toBeLessThanOrEqual(25);
    expect(r.hot).toBe(false);
  });

  it("does not cap when no block keyword matches", () => {
    const profile = {
      ...defaultProfile(),
      targetNaics: ["237310"],
      targetStates: ["NC"],
      minValue: 1_000_000,
      maxValue: 10_000_000,
      preferredTiers: ["TRANSPORTATION"],
      blockKeywords: ["data center"],
    };
    const r = scoreListing(
      { ...baseListing, placeOfPerformance: "Raleigh, NC" },
      profile
    );
    expect(r.score).toBeGreaterThan(25);
  });

  it("block keyword detected in summary too, not just title", () => {
    const profile = {
      ...defaultProfile(),
      targetNaics: ["237310"],
      blockKeywords: ["i-40"],
    };
    const r = scoreListing(baseListing, profile);
    expect(r.score).toBeLessThanOrEqual(25);
  });
});
