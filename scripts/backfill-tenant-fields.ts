/**
 * One-shot data backfills for Tenant fields added after seed.
 *
 * Currently:
 *   - preferredProvider: any tenant pre-pass-15 has NULL here. Set
 *     it to "openai" (the schema default) so the resolveKey logic in
 *     src/lib/ai.ts gets a deterministic value to read.
 *
 * Run: `npx tsx scripts/backfill-tenant-fields.ts`. Idempotent.
 */

import "dotenv/config";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

async function main() {
  const url = process.env.DATABASE_URL ?? `file:${path.join(process.cwd(), "prisma", "dev.db")}`;
  const adapter = new PrismaBetterSqlite3({ url: url.startsWith("file:") ? url : `file:${url}` });
  const prisma = new PrismaClient({ adapter });
  try {
    const r = await prisma.tenant.updateMany({
      where: { preferredProvider: null },
      data: { preferredProvider: "openai" },
    });
    console.log(`backfill: preferredProvider set on ${r.count} tenant(s)`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
