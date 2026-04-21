import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/permissions";
import { publicRedirect } from "@/lib/redirect";
import type { ProjectMode } from "@prisma/client";

const VALID_MODES: ProjectMode[] = ["SIMPLE", "VERTICAL", "HEAVY_CIVIL"];

export async function POST(req: Request, ctx: { params: Promise<{ tenantId: string }> }) {
  const admin = await requireSuperAdmin();
  const { tenantId } = await ctx.params;
  const form = await req.formData();
  const name = String(form.get("name") ?? "").trim();
  const slug = String(form.get("slug") ?? "").trim().toLowerCase();
  const primaryMode = String(form.get("primaryMode") ?? "") as ProjectMode;
  const enabledModes = form.getAll("enabledModes").map((v) => String(v) as ProjectMode).filter((m) => VALID_MODES.includes(m));
  const featurePacksRaw = String(form.get("featurePacks") ?? "").trim();
  const featurePacks = featurePacksRaw ? featurePacksRaw.split(",").map((s) => s.trim()).filter(Boolean) : [];

  if (!name || !slug) return NextResponse.json({ error: "name + slug required" }, { status: 400 });
  if (!VALID_MODES.includes(primaryMode)) return NextResponse.json({ error: "invalid primary mode" }, { status: 400 });
  if (!enabledModes.includes(primaryMode)) return NextResponse.json({ error: "primary mode must be enabled" }, { status: 400 });

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { name, slug, primaryMode, enabledModes: JSON.stringify(enabledModes), featurePacks: JSON.stringify(featurePacks) },
  });
  await prisma.auditEvent.create({
    data: { tenantId, actorId: admin.userId, entityType: "Tenant", entityId: tenantId, action: "TENANT_EDITED", afterJson: JSON.stringify({ name, slug, primaryMode, enabledModes, featurePacks }), source: "admin/edit" },
  });
  return publicRedirect(req, `/admin/tenants/${tenantId}`, 303);
}
