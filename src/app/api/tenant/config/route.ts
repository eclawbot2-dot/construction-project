import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentTenantSlug } from "@/lib/tenant";
import { ProjectMode } from "@prisma/client";

const VALID_MODES = new Set(Object.values(ProjectMode));

export async function POST(req: Request) {
  const slug = await currentTenantSlug();
  const tenant = slug ? await prisma.tenant.findUnique({ where: { slug } }) : await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" } });
  if (!tenant) return NextResponse.json({ error: "no tenant" }, { status: 404 });

  const form = await req.formData();
  const primaryMode = String(form.get("primaryMode") ?? tenant.primaryMode);
  const enabledModesRaw = form.getAll("enabledModes").map((v) => String(v));
  const enabledModes = enabledModesRaw.filter((m) => VALID_MODES.has(m as ProjectMode));
  if (!enabledModes.includes(primaryMode)) enabledModes.push(primaryMode);

  if (!VALID_MODES.has(primaryMode as ProjectMode)) {
    return NextResponse.json({ error: "invalid primaryMode" }, { status: 400 });
  }

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      primaryMode: primaryMode as ProjectMode,
      enabledModes: JSON.stringify(enabledModes),
    },
  });

  await prisma.auditEvent.create({
    data: {
      tenantId: tenant.id,
      entityType: "Tenant",
      entityId: tenant.id,
      action: "MODE_CONFIG_UPDATED",
      afterJson: JSON.stringify({ primaryMode, enabledModes }),
      source: "settings",
    },
  });

  const redirectTo = String(form.get("redirect") ?? "/settings") || "/settings";
  return NextResponse.redirect(new URL(redirectTo, req.url), { status: 303 });
}
