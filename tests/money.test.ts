import { describe, it, expect } from "vitest";
import { roundCents, sumMoney, multiplyMoney, subtractMoney, addMoney, percentOf, toCents, fromCents, eqMoney } from "../src/lib/money";

describe("money — Float drift safety", () => {
  it("0.1 + 0.2 sums exactly to 0.30, not 0.30000000000000004", () => {
    expect(sumMoney([0.1, 0.2])).toBe(0.3);
    expect(0.1 + 0.2).not.toBe(0.3);  // proves Float drift
  });

  it("sums hundreds of pennies without accumulating drift", () => {
    const list = Array.from({ length: 100 }, () => 0.01);
    expect(sumMoney(list)).toBe(1.0);
    // Naive sum drifts:
    let naive = 0;
    for (const v of list) naive += v;
    expect(naive).not.toBe(1.0);
  });

  it("ignores null / undefined / NaN values", () => {
    expect(sumMoney([1, null, 2, undefined, NaN, 3])).toBe(6);
  });

  it("addMoney + subtractMoney use safe rounding", () => {
    expect(addMoney(0.1, 0.2)).toBe(0.3);
    expect(subtractMoney(1.0, 0.7)).toBe(0.3);
  });

  it("multiplyMoney rounds to cents", () => {
    expect(multiplyMoney(100, 0.0825)).toBe(8.25);
    expect(multiplyMoney(33.33, 3)).toBe(99.99);
  });

  it("percentOf: 8.25% of $100 = $8.25", () => {
    expect(percentOf(100, 8.25)).toBe(8.25);
  });

  it("roundCents: 0.005 rounds up (HALF_UP); -0.005 rounds toward zero", () => {
    expect(roundCents(0.005)).toBe(0.01);
    expect(roundCents(0.014)).toBe(0.01);
    expect(roundCents(0.015)).toBe(0.02);
  });

  it("toCents / fromCents round-trip preserves value", () => {
    expect(fromCents(toCents(123.45))).toBe(123.45);
    expect(fromCents(toCents(0))).toBe(0);
  });

  it("eqMoney tolerates 1-cent drift", () => {
    expect(eqMoney(0.1 + 0.2, 0.3)).toBe(true);
    expect(eqMoney(100.001, 100.00)).toBe(true);
    expect(eqMoney(100.02, 100.00)).toBe(false);
  });
});
