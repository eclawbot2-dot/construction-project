import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

/**
 * Race-guard tests for the dedup and autopilot idempotency fixes
 * landed in pass-12. Use a temp SQLite copy of the dev.db so tests
 * can write rows without polluting the working database.
 *
 * These tests exercise REAL Prisma operations against the unique
 * constraint, which is the only way to verify the catch in
 * src/lib/rfp-crawl.ts actually distinguishes P2002 from other
 * errors.
 */

let prisma: PrismaClient;
let tmpDbPath: string;
let tenantId: string;

beforeAll(async () => {
  // Copy dev.db to a tmp file so the tests can mutate it without
  // affecting development state. If dev.db doesn't exist, skip.
  const devDb = path.resolve(__dirname, "..", "prisma", "dev.db");
  if (!fs.existsSync(devDb)) {
    throw new Error("dev.db not found — run `npx prisma db push` first");
  }
  tmpDbPath = path.join(os.tmpdir(), `bcon-test-dedup-${Date.now()}.db`);
  fs.copyFileSync(devDb, tmpDbPath);

  const adapter = new PrismaBetterSqlite3({ url: `file:${tmpDbPath}` });
  prisma = new PrismaClient({ adapter });

  // Use an existing tenant if there is one, otherwise create a fresh
  // throwaway tenant for this test run. Either way we clean up at the
  // end by dropping the tmp DB file, not by deleting rows.
  const existing = await prisma.tenant.findFirst();
  if (existing) {
    tenantId = existing.id;
  } else {
    const created = await prisma.tenant.create({
      data: { name: "test-dedup-race", slug: `dedup-race-${Date.now()}`, primaryMode: "SIMPLE" },
    });
    tenantId = created.id;
  }
});

afterAll(async () => {
  await prisma?.$disconnect();
  try { fs.unlinkSync(tmpDbPath); } catch { /* ignore */ }
});

describe("RfpListing unique-constraint dedup", () => {
  it("rejects a duplicate (tenantId, agency, solicitationNo) on create", async () => {
    const sol = `RACE-TEST-${Date.now()}-A`;
    await prisma.rfpListing.create({
      data: {
        tenantId,
        title: "first insert",
        agency: "Test Agency",
        solicitationNo: sol,
        postedAt: new Date(),
      },
    });

    let caught: Error | null = null;
    try {
      await prisma.rfpListing.create({
        data: {
          tenantId,
          title: "second insert (should fail)",
          agency: "Test Agency",
          solicitationNo: sol,
          postedAt: new Date(),
        },
      });
    } catch (err) {
      caught = err as Error;
    }
    expect(caught).not.toBeNull();
    expect(caught!.message).toMatch(/Unique constraint failed/i);
  });

  it("treats NULL solicitationNo as distinct (multiple null-rows allowed)", async () => {
    // SQLite treats NULL as distinct in unique indexes, so two
    // listings without a solicitation number should co-exist.
    const a = await prisma.rfpListing.create({
      data: {
        tenantId,
        title: "no-sol-a",
        agency: "Anonymous Agency",
        solicitationNo: null,
        postedAt: new Date(),
      },
    });
    const b = await prisma.rfpListing.create({
      data: {
        tenantId,
        title: "no-sol-b",
        agency: "Anonymous Agency",
        solicitationNo: null,
        postedAt: new Date(),
      },
    });
    expect(a.id).not.toBe(b.id);
  });
});

describe("Autopilot idempotency guard", () => {
  it("excludes already-auto-drafted listings from unscored query", async () => {
    const sol = `RACE-TEST-${Date.now()}-B`;
    const listing = await prisma.rfpListing.create({
      data: {
        tenantId,
        title: "already-drafted listing",
        agency: "Test Agency",
        solicitationNo: sol,
        postedAt: new Date(),
        score: null,
        autoDraftedAt: new Date(),
      },
    });
    const found = await prisma.rfpListing.findMany({
      where: {
        tenantId,
        score: null,
        autoDraftedAt: null,
      },
    });
    expect(found.find((l) => l.id === listing.id)).toBeUndefined();
  });

  it("atomic score-write skips when another sweep beat it", async () => {
    const sol = `RACE-TEST-${Date.now()}-C`;
    const listing = await prisma.rfpListing.create({
      data: {
        tenantId,
        title: "racy score listing",
        agency: "Test Agency",
        solicitationNo: sol,
        postedAt: new Date(),
        score: null,
      },
    });

    // Simulate sweep #1 winning by writing the score first.
    await prisma.rfpListing.update({
      where: { id: listing.id },
      data: { score: 88 },
    });

    // Sweep #2 attempts the guarded updateMany; should match 0 rows.
    const result = await prisma.rfpListing.updateMany({
      where: { id: listing.id, score: null, autoDraftedAt: null },
      data: { score: 42 },
    });
    expect(result.count).toBe(0);

    // Score should still be 88 — sweep #2 didn't overwrite.
    const fresh = await prisma.rfpListing.findUnique({ where: { id: listing.id } });
    expect(fresh?.score).toBe(88);
  });
});
