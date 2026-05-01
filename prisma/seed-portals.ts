/**
 * Standalone catalog refresh — `npx tsx prisma/seed-portals.ts`.
 * Idempotent. Safe to run against a live database; will not touch tenant
 * data. Run this whenever portal-catalog.ts is updated to push the new
 * entries into production without re-seeding tenants.
 */

import "dotenv/config";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { upsertPortalCatalog } from "./portal-catalog";

async function main() {
  const url = process.env.DATABASE_URL ?? `file:${path.join(process.cwd(), "prisma", "dev.db")}`;
  const adapter = new PrismaBetterSqlite3({ url: url.startsWith("file:") ? url : `file:${url}` });
  const prisma = new PrismaClient({ adapter });
  try {
    const { created, updated } = await upsertPortalCatalog(prisma);
    console.log(`portal catalog: ${created} created, ${updated} updated`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
