import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const COOKIE = "cx.tenant";

/** Read the active tenant slug from the cookie. */
export async function currentTenantSlug(): Promise<string | null> {
  try {
    const store = await cookies();
    return store.get(COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

/** Resolve the active tenant (by cookie, falling back to the first tenant). */
export async function getCurrentTenant() {
  const slug = await currentTenantSlug();
  if (slug) {
    const bySlug = await prisma.tenant.findUnique({ where: { slug } });
    if (bySlug) return bySlug;
  }
  return prisma.tenant.findFirst({ orderBy: { createdAt: "asc" } });
}

/** Shortcut that throws if no tenant is configured. */
export async function requireTenant() {
  const tenant = await getCurrentTenant();
  if (!tenant) throw new Error("No tenant configured");
  return tenant;
}

/** List every tenant (for the switcher). */
export async function listTenants() {
  return prisma.tenant.findMany({ orderBy: { name: "asc" } });
}
