import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
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

export type CreateTenantResult =
  | {
      ok: true;
      tenantId: string;
      slug: string;
      adminEmail: string;
      /**
       * Plaintext password for the admin user, ONLY returned when the
       * route just created a brand-new User record. Pre-existing users
       * keep their existing password; in that case this is undefined.
       *
       * Pass-10: previously the function generated `setup-${random}`,
       * hashed it, and returned nothing — leaving the customer's first
       * admin unable to log in because no human ever knew the password.
       * Now the temp password is surfaced so the operator can hand it
       * off out-of-band (until a real email-reset flow exists).
       */
      adminTempPassword?: string;
    }
  | { ok: false; error: string };

/**
 * Create a new tenant plus its starter scaffolding:
 *   - A BusinessUnit (defaults to "Main")
 *   - An admin User + Membership (defaults to a generic placeholder email)
 *
 * Safe to call against a fresh database or a live one. The tenant's slug
 * must be unique. If the admin email is new, a temp password is generated
 * and returned in `adminTempPassword`; the operator must communicate it
 * out-of-band (no email transport is wired yet).
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
    let adminTempPassword: string | undefined;
    let user;
    if (existingUser) {
      user = existingUser;
    } else {
      // 18 chars of crypto-random base64url — long enough to resist
      // brute force, short enough to type from a sticky note. The
      // operator must communicate this to the admin out-of-band.
      adminTempPassword = randomBytes(13).toString("base64url");
      user = await prisma.user.create({
        data: {
          name: adminName,
          email: adminEmail,
          password: await bcrypt.hash(adminTempPassword, 10),
        },
      });
    }
    await prisma.membership.create({
      data: { tenantId: tenant.id, userId: user.id, roleTemplate: "ADMIN" },
    });
    await prisma.auditEvent.create({
      data: {
        tenantId: tenant.id,
        entityType: "Tenant",
        entityId: tenant.id,
        action: "TENANT_CREATED",
        afterJson: JSON.stringify({ name, slug, primaryMode: input.primaryMode, enabledModes: input.enabledModes, adminEmail, newAdminUser: !existingUser }),
        source: "settings/create",
      },
    });
    return { ok: true, tenantId: tenant.id, slug: tenant.slug, adminEmail, adminTempPassword };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Tenant creation failed." };
  }
}
