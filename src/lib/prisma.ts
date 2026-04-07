import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function resolveDbUrl() {
  const configured = process.env.DATABASE_URL;
  if (configured) {
    return configured.startsWith("file:") ? configured : `file:${configured}`;
  }

  return `file:${path.join(process.cwd(), "prisma", "dev.db")}`;
}

function createPrismaClient() {
  const adapter = new PrismaBetterSqlite3({ url: resolveDbUrl() });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
