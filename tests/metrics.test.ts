import { describe, it, expect, beforeEach } from "vitest";
import {
  observeRequest,
  observeError,
  observeCronRun,
  snapshot,
  normalizePath,
  __resetForTest,
} from "../src/lib/metrics";

describe("metrics", () => {
  beforeEach(() => {
    __resetForTest();
  });

  it("normalizes cuid path segments to :id", () => {
    expect(normalizePath("/projects/cmd1234567890abcdefghij1234")).toBe("/projects/:id");
    expect(normalizePath("/projects/cmd1234567890abcdefghij1234/rfis/cmd1234567890abcdefghij5678")).toBe("/projects/:id/rfis/:id");
  });

  it("normalizes UUID path segments to :id", () => {
    expect(normalizePath("/api/admin/users/12345678-1234-1234-1234-123456789012")).toBe("/api/admin/users/:id");
  });

  it("preserves non-id segments", () => {
    expect(normalizePath("/api/health")).toBe("/api/health");
    expect(normalizePath("/projects/by-stage/active")).toBe("/projects/by-stage/active");
  });

  it("strips query strings before normalization", () => {
    expect(normalizePath("/projects/cmd1234567890abcdefghij1234?tab=rfis")).toBe("/projects/:id");
  });

  it("captures requests and computes basic stats", () => {
    observeRequest({ t: Date.now(), method: "GET", path: "/api/test", status: 200, ms: 50 });
    observeRequest({ t: Date.now(), method: "GET", path: "/api/test", status: 200, ms: 100 });
    observeRequest({ t: Date.now(), method: "GET", path: "/api/test", status: 500, ms: 200 });
    const s = snapshot();
    expect(s.totalRequests).toBe(3);
    expect(s.errorCount).toBe(1);
    expect(s.errorRate).toBeCloseTo(1 / 3, 5);
    expect(s.perRoute).toHaveLength(1);
    expect(s.perRoute[0]!.route).toBe("GET /api/test");
    expect(s.perRoute[0]!.count).toBe(3);
    expect(s.perRoute[0]!.errorCount).toBe(1);
  });

  it("computes p50 and p95 from samples", () => {
    for (let i = 1; i <= 100; i++) {
      observeRequest({ t: Date.now(), method: "GET", path: "/api/x", status: 200, ms: i });
    }
    const s = snapshot();
    // p50 should be around 50, p95 around 95
    expect(s.p50Ms).toBeGreaterThanOrEqual(40);
    expect(s.p50Ms).toBeLessThanOrEqual(60);
    expect(s.p95Ms).toBeGreaterThanOrEqual(85);
    expect(s.p95Ms).toBeLessThanOrEqual(100);
  });

  it("flags slow requests", () => {
    observeRequest({ t: Date.now(), method: "GET", path: "/api/fast", status: 200, ms: 50 });
    observeRequest({ t: Date.now(), method: "GET", path: "/api/slow", status: 200, ms: 1500 });
    const s = snapshot();
    expect(s.slowCount).toBe(1);
    expect(s.recentSlow).toHaveLength(1);
    expect(s.recentSlow[0]!.path).toBe("/api/slow");
  });

  it("respects time window for snapshots", () => {
    observeRequest({ t: Date.now() - 2 * 60 * 60 * 1000, method: "GET", path: "/api/old", status: 200, ms: 10 });
    observeRequest({ t: Date.now(), method: "GET", path: "/api/recent", status: 200, ms: 20 });
    const s60 = snapshot(60 * 60 * 1000); // 1 hour window
    expect(s60.totalRequests).toBe(1);
    expect(s60.perRoute[0]!.route).toBe("GET /api/recent");
    const s24h = snapshot(24 * 60 * 60 * 1000);
    expect(s24h.totalRequests).toBe(2);
  });

  it("captures recent errors with metadata", () => {
    observeError({ t: Date.now(), module: "test", message: "boom", path: "/api/x" });
    const s = snapshot();
    expect(s.recentErrors).toHaveLength(1);
    expect(s.recentErrors[0]!.message).toBe("boom");
    expect(s.recentErrors[0]!.module).toBe("test");
  });

  it("tracks cron runs", () => {
    observeCronRun({ name: "backup", startedAt: 1000, finishedAt: 2000, ok: true, message: "all good" });
    observeCronRun({ name: "rfp-sweep", startedAt: 3000, finishedAt: 3500, ok: false, message: "timeout" });
    const s = snapshot();
    expect(s.cronRuns).toHaveLength(2);
    // Most recent first
    expect(s.cronRuns[0]!.name).toBe("rfp-sweep");
    expect(s.cronRuns[0]!.ok).toBe(false);
  });

  it("ring buffer caps memory at 500 requests", () => {
    for (let i = 0; i < 600; i++) {
      observeRequest({ t: Date.now(), method: "GET", path: `/api/r${i}`, status: 200, ms: 1 });
    }
    const s = snapshot();
    // Older 100 requests overwritten — we should see at most 500 distinct routes
    expect(s.totalRequests).toBeLessThanOrEqual(500);
    expect(s.perRoute.length).toBeLessThanOrEqual(500);
  });
});
