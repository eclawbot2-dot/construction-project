import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { ProjectMode } from "@prisma/client";

export type CreateTenantInput = {
  name: string;
  slug: string;
  primaryMode: ProjectMode;
  enabledModes: ProjectMode[];
  adminName?: string;
  adminEmail?: string;
  businessUnitName?: string;
  region?: string;
};

export type CreateTenantResult = { ok: true; tenantId: string; slug: string } | { ok: false; error: string };

/**
 * Create a new tenant plus its starter scaffolding:
 *   - A BusinessUnit (defaults to "Main")
 *   - An admin User + Membership (defaults to a generic placeholder email)
 *
 * Safe to call against a fresh database or a live one. The tenant's slug
 * must be unique; the admin email gets a random password the user can
 * reset via the /settings page later.
 */
export async function createTenant(input: CreateTenantInput): Promise<CreateTenantResult> {
  const name = input.name.trim();
  const slug = input.slug.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  if (!name || name.length < 2) return { ok: false, error: "Tenant name required (min 2 chars)." };
  if (!slug || slug.length < 2) return { ok: false, error: "Slug required (alphanumeric / hyphen, min 2 chars)." };
  if (input.enabledModes.length === 0) return { ok: false, error: "At least one operating mode must be enabled." };
  if (!input.enabledModes.includes(input.primaryMode)) return { ok: false, error: "Primary mode must be one of the enabled modes." };

  const existing = await prisma.tenant.findUnique({ where: { slug } });
  if (existing) return { ok: false, error: `A tenant already exists with slug "${slug}".` };

  const adminEmail = (input.adminEmail ?? `${slug}-admin@example.com`).trim().toLowerCase();
  const adminName = input.adminName?.trim() || `${name} Admin`;
  const buName = input.businessUnitName?.trim() || "Main";

  try {
    const tenant = await prisma.tenant.create({
      data: {
        name,
        slug,
        primaryMode: input.primaryMode,
        enabledModes: JSON.stringify(input.enabledModes),
      },
    });
    await prisma.businessUnit.create({
      data: {
        tenantId: tenant.id,
        name: buName,
        code: "MAIN",
        defaultMode: input.primaryMode,
        region: input.region ?? null,
      },
    });
    const existingUser = await prisma.user.findUnique({ where: { email: adminEmail } });
    const user = existingUser ?? await prisma.user.create({
      data: {
        name: adminName,
        email: adminEmail,
        password: await bcrypt.hash(`setup-${Math.random().toString(36).slice(2)}`, 10),
      },
    });
    await prisma.membership.create({
      data: { tenantId: tenant.id, userId: user.id, roleTemplate: "ADMIN" },
    });
    await prisma.auditEvent.create({
      data: {
        tenantId: tenant.id,
        entityType: "Tenant",
        entityId: tenant.id,
        action: "TENANT_CREATED",
        afterJson: JSON.stringify({ name, slug, primaryMode: input.primaryMode, enabledModes: input.enabledModes, adminEmail }),
        source: "settings/create",
      },
    });
    return { ok: true, tenantId: tenant.id, slug: tenant.slug };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Tenant creation failed." };
  }
}
