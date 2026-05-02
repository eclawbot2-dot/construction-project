import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

let prisma: PrismaClient;
let tenantId: string;

beforeAll(async () => {
  const url = process.env.DATABASE_URL ?? `file:${path.join(process.cwd(), "prisma", "dev.db")}`;
  const adapter = new PrismaBetterSqlite3({ url: url.startsWith("file:") ? url : `file:${url}` });
  prisma = new PrismaClient({ adapter });
  const t = await prisma.tenant.create({ data: { name: `CC test ${Date.now()}`, slug: `cc-${Date.now()}`, primaryMode: "VERTICAL" } });
  tenantId = t.id;
});

afterAll(async () => {
  if (tenantId) await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => { /* cleanup */ });
  await prisma?.$disconnect();
});

describe("seedDefaultCostCodes — idempotency", () => {
  it("creates 25 CSI divisions on first run for a fresh tenant", async () => {
    const { seedDefaultCostCodes } = await import("../src/lib/cost-codes-csi");
    const result = await seedDefaultCostCodes(tenantId);
    expect(result.created).toBe(25);
    const count = await prisma.costCode.count({ where: { tenantId } });
    expect(count).toBe(25);
  });

  it("creates zero new rows on a second run (idempotent)", async () => {
    const { seedDefaultCostCodes } = await import("../src/lib/cost-codes-csi");
    const result = await seedDefaultCostCodes(tenantId);
    expect(result.created).toBe(0);
    const count = await prisma.costCode.count({ where: { tenantId } });
    expect(count).toBe(25);
  });

  it("doesn't disturb tenant-custom rows added between seed runs", async () => {
    await prisma.costCode.create({
      data: { tenantId, code: "01-100", name: "Custom GR sub", description: "tenant-specific", level: 1 },
    });
    const { seedDefaultCostCodes } = await import("../src/lib/cost-codes-csi");
    await seedDefaultCostCodes(tenantId);
    const custom = await prisma.costCode.findFirst({ where: { tenantId, code: "01-100" } });
    expect(custom?.name).toBe("Custom GR sub");
  });
});
