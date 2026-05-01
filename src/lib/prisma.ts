import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Resolve the local SQLite database URL.
 *
 * NOTE: Production should run on Postgres. To switch:
 *   1. Change `provider` in prisma/schema.prisma to "postgresql".
 *   2. `npm install @prisma/adapter-pg pg @types/pg` (currently NOT in
 *      package.json; SQLite is the only adapter wired today).
 *   3. Replace this file's `createPrismaClient` body with the Postgres
 *      adapter:
 *         import { PrismaPg } from "@prisma/adapter-pg";
 *         const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
 *         return new PrismaClient({ adapter });
 *   4. Plan the Float -> Decimal migration for currency-bearing fields
 *      (see docs/pass-audit-07.md §1.2).
 *
 * Until Postgres is wired, DATABASE_URL is treated as a SQLite file path
 * regardless of scheme — pointing it at a postgres:// URL will silently
 * coerce to file: form and corrupt the URL. Postgres is intentionally
 * not auto-detected here so a half-finished migration cannot ship.
 */
function resolveSqliteUrl() {
  const configured = process.env.DATABASE_URL;
  if (configured) {
    if (configured.startsWith("postgres://") || configured.startsWith("postgresql://")) {
      throw new Error(
        "DATABASE_URL is a Postgres URL but this build is wired for SQLite only. " +
        "Wire @prisma/adapter-pg in src/lib/prisma.ts before pointing at Postgres.",
      );
    }
    return configured.startsWith("file:") ? configured : `file:${configured}`;
  }
  return `file:${path.join(process.cwd(), "prisma", "dev.db")}`;
}

function createPrismaClient() {
  const adapter = new PrismaBetterSqlite3({ url: resolveSqliteUrl() });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
