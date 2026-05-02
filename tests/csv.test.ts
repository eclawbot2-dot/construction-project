import { describe, it, expect } from "vitest";
import { csvField, toCsv } from "../src/lib/csv";

describe("csvField — RFC 4180 + formula-injection defense", () => {
  it("wraps every cell in double-quotes", () => {
    expect(csvField("hello")).toBe('"hello"');
  });

  it("escapes internal double-quotes per RFC 4180", () => {
    expect(csvField('he said "hi"')).toBe('"he said ""hi"""');
  });

  it("prefixes leading = with single quote (defang Excel formula)", () => {
    expect(csvField("=2+2")).toBe(`"'=2+2"`);
  });

  it("prefixes leading + (Excel formula trigger)", () => {
    expect(csvField("+SUM(A1)")).toBe(`"'+SUM(A1)"`);
  });

  it("prefixes leading - (Excel formula trigger)", () => {
    expect(csvField("-99")).toBe(`"'-99"`);
  });

  it("prefixes leading @ (Lotus / older Excel formula trigger)", () => {
    expect(csvField("@HYPERLINK")).toBe(`"'@HYPERLINK"`);
  });

  it("prefixes leading tab (parser-bypass leader)", () => {
    expect(csvField("\t=DDE")).toBe(`"'\t=DDE"`);
  });

  it("does NOT prefix harmless leading characters", () => {
    expect(csvField("hello")).toBe('"hello"');
    expect(csvField("123")).toBe('"123"');
    expect(csvField("'single-already")).toBe(`"'single-already"`);
  });

  it("handles empty string without erroring", () => {
    expect(csvField("")).toBe('""');
  });
});

describe("toCsv — also defangs formula-leading cells", () => {
  it("defangs equals-leading cells in row data", () => {
    const out = toCsv([{ name: "=cmd|/c calc" }], ["name"]);
    // Match — output contains the defanged form, prefixed with BOM.
    expect(out).toMatch(/'=cmd/);
  });
});
