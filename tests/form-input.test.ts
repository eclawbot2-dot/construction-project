import { describe, it, expect } from "vitest";
import {
  parseStringField,
  parseNumberField,
  parseDateField,
  parseEnumField,
} from "../src/lib/form-input";

describe("parseStringField", () => {
  it("returns fallback for null", () => {
    expect(parseStringField(null, "fallback")).toBe("fallback");
    expect(parseStringField(null, null)).toBe(null);
  });
  it("returns fallback for empty string", () => {
    expect(parseStringField("", "old")).toBe("old");
  });
  it("returns fallback for whitespace-only string", () => {
    expect(parseStringField("   ", "old")).toBe("old");
    expect(parseStringField("\t\n  ", "old")).toBe("old");
  });
  it("returns trimmed value otherwise", () => {
    expect(parseStringField("  hello  ", null)).toBe("hello");
    expect(parseStringField("hello", null)).toBe("hello");
  });
});

describe("parseNumberField", () => {
  it("returns fallback for null/empty/whitespace", () => {
    expect(parseNumberField(null, 0)).toBe(0);
    expect(parseNumberField("", 0)).toBe(0);
    expect(parseNumberField("   ", 0)).toBe(0);
    expect(parseNumberField(null, null)).toBe(null);
  });
  it("returns fallback for non-numeric", () => {
    expect(parseNumberField("abc", 5)).toBe(5);
    expect(parseNumberField("12abc", 5)).toBe(5);
  });
  it("parses integers and decimals", () => {
    expect(parseNumberField("42", null)).toBe(42);
    expect(parseNumberField("3.14", null)).toBe(3.14);
    expect(parseNumberField("-7", null)).toBe(-7);
  });
  it("trims before parsing", () => {
    expect(parseNumberField("  42  ", null)).toBe(42);
  });
  it("rejects NaN/Infinity", () => {
    expect(parseNumberField("NaN", 0)).toBe(0);
    expect(parseNumberField("Infinity", 0)).toBe(0);
  });
  it("clamps to min", () => {
    expect(parseNumberField("-50", 0, { min: 0 })).toBe(0);
    expect(parseNumberField("50", 0, { min: 0 })).toBe(50);
  });
  it("clamps to max", () => {
    expect(parseNumberField("250", 0, { max: 100 })).toBe(100);
    expect(parseNumberField("50", 0, { max: 100 })).toBe(50);
  });
  it("clamps to both bounds", () => {
    expect(parseNumberField("-50", 0, { min: 0, max: 100 })).toBe(0);
    expect(parseNumberField("250", 0, { min: 0, max: 100 })).toBe(100);
    expect(parseNumberField("50", 0, { min: 0, max: 100 })).toBe(50);
  });
});

describe("parseDateField", () => {
  it("returns fallback for null/whitespace", () => {
    const fallback = new Date("2025-01-01T00:00:00Z");
    expect(parseDateField(null, fallback)).toBe(fallback);
    expect(parseDateField("   ", null)).toBe(null);
  });
  it("returns null for empty string (signals 'clear the field')", () => {
    expect(parseDateField("", null)).toBe(null);
  });
  it("anchors yyyy-mm-dd at UTC midnight", () => {
    const d = parseDateField("2026-05-15", null);
    expect(d).not.toBeNull();
    expect(d!.toISOString()).toBe("2026-05-15T00:00:00.000Z");
  });
  it("returns fallback for malformed", () => {
    const fallback = new Date("2025-01-01T00:00:00Z");
    expect(parseDateField("not-a-date", fallback)).toBe(fallback);
  });
  it("falls back to native Date for non-yyyy-mm-dd values", () => {
    const d = parseDateField("2026-05-15T08:00:00Z", null);
    expect(d).not.toBeNull();
    expect(d!.toISOString()).toBe("2026-05-15T08:00:00.000Z");
  });
});

describe("parseEnumField", () => {
  const allowed = ["ACTIVE", "INACTIVE", "PENDING"] as const;
  it("returns fallback for null/empty", () => {
    expect(parseEnumField(null, allowed, "ACTIVE")).toBe("ACTIVE");
    expect(parseEnumField("", allowed, "ACTIVE")).toBe("ACTIVE");
  });
  it("returns the value when valid", () => {
    expect(parseEnumField("INACTIVE", allowed, "ACTIVE")).toBe("INACTIVE");
  });
  it("returns null for invalid (caller should reply 400)", () => {
    expect(parseEnumField("ELSEWHERE", allowed, "ACTIVE")).toBe(null);
  });
  it("trims before checking", () => {
    expect(parseEnumField("  ACTIVE  ", allowed, "PENDING")).toBe("ACTIVE");
  });
});
