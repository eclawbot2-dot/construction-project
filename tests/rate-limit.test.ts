import { describe, it, expect, beforeEach } from "vitest";
import { consumeRateLimit, resetRateLimit, _resetAllRateLimits } from "../src/lib/rate-limit";

describe("consumeRateLimit", () => {
  beforeEach(() => {
    _resetAllRateLimits();
  });

  it("allows up to limit requests then denies", () => {
    const opts = { limit: 3, windowMs: 60_000 };
    expect(consumeRateLimit("k", opts).allowed).toBe(true);
    expect(consumeRateLimit("k", opts).allowed).toBe(true);
    expect(consumeRateLimit("k", opts).allowed).toBe(true);
    expect(consumeRateLimit("k", opts).allowed).toBe(false);
  });

  it("returns remaining count correctly", () => {
    const opts = { limit: 5, windowMs: 60_000 };
    expect(consumeRateLimit("k", opts).remaining).toBe(4);
    expect(consumeRateLimit("k", opts).remaining).toBe(3);
  });

  it("scopes per key", () => {
    const opts = { limit: 1, windowMs: 60_000 };
    expect(consumeRateLimit("k1", opts).allowed).toBe(true);
    expect(consumeRateLimit("k2", opts).allowed).toBe(true);
    expect(consumeRateLimit("k1", opts).allowed).toBe(false);
    expect(consumeRateLimit("k2", opts).allowed).toBe(false);
  });

  it("resetRateLimit clears the bucket", () => {
    const opts = { limit: 2, windowMs: 60_000 };
    consumeRateLimit("k", opts);
    consumeRateLimit("k", opts);
    expect(consumeRateLimit("k", opts).allowed).toBe(false);
    resetRateLimit("k");
    expect(consumeRateLimit("k", opts).allowed).toBe(true);
  });

  it("expires hits after the window passes", async () => {
    const opts = { limit: 2, windowMs: 50 };
    expect(consumeRateLimit("k", opts).allowed).toBe(true);
    expect(consumeRateLimit("k", opts).allowed).toBe(true);
    expect(consumeRateLimit("k", opts).allowed).toBe(false);
    await new Promise((r) => setTimeout(r, 70));
    expect(consumeRateLimit("k", opts).allowed).toBe(true);
  });

  it("resetAt is the oldest hit + window when blocked", () => {
    const opts = { limit: 1, windowMs: 1000 };
    const t0 = Date.now();
    consumeRateLimit("k", opts);
    const blocked = consumeRateLimit("k", opts);
    expect(blocked.allowed).toBe(false);
    expect(blocked.resetAt).toBeGreaterThanOrEqual(t0 + 1000 - 50);
    expect(blocked.resetAt).toBeLessThanOrEqual(t0 + 1000 + 50);
  });
});
