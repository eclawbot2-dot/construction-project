import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireManager } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { publicRedirect } from "@/lib/redirect";
import { parseEnumField, parseNumberField, parseStringField } from "@/lib/form-input";
import { ProjectMode, ProjectStage } from "@prisma/client";

const VALID_MODES: ProjectMode[] = ["SIMPLE", "VERTICAL", "HEAVY_CIVIL"];

/**
 * Create a new Project under the current tenant. Pass-11 added because
 * the only project-creation path until now was via /api/opportunities/
 * [id]/convert — a freshly-onboarded customer with no opportunities
 * couldn't add a project from the UI.
 */
export async function POST(req: Request) {
  const tenant = await requireTenant();
  const actor = await requireManager(tenant.id);
  const form = await req.formData();

  const name = parseStringField(form.get("name"), null);
  const code = parseStringField(form.get("code"), null);
  const mode = parseEnumField(form.get("mode"), VALID_MODES, "VERTICAL");
  if (!name || !code || !mode) {
    return NextResponse.json({ error: "name, code, and mode required" }, { status: 400 });
  }

  // Slug-style enforcement on code so it never collides with URL parsing.
  const cleanCode = code.toUpperCase().replace(/[^A-Z0-9-]/g, "-").slice(0, 32);
  if (!cleanCode) return NextResponse.json({ error: "code must include letters or digits" }, { status: 400 });

  const existing = await prisma.project.findFirst({
    where: { tenantId: tenant.id, code: cleanCode },
  });
  if (existing) {
    return NextResponse.json({ error: `A project with code "${cleanCode}" already exists in this tenant.` }, { status: 409 });
  }

  // Optional business unit. If the tenant has no BUs, fall back to null.
  const businessUnitIdRaw = parseStringField(form.get("businessUnitId"), null);
  let businessUnitId: string | null = null;
  if (businessUnitIdRaw) {
    const bu = await prisma.businessUnit.findFirst({
      where: { id: businessUnitIdRaw, tenantId: tenant.id },
    });
    if (bu) businessUnitId = bu.id;
  }

  const project = await prisma.project.create({
    data: {
      tenantId: tenant.id,
      businessUnitId,
      name,
      code: cleanCode,
      mode,
      stage: ProjectStage.PRECONSTRUCTION,
      ownerName: parseStringField(form.get("ownerName"), null),
      address: parseStringField(form.get("address"), null),
      contractType: parseStringField(form.get("contractType"), null),
      contractValue: parseNumberField(form.get("contractValue"), null, { min: 0 }),
      marginTargetPct: parseNumberField(form.get("marginTargetPct"), null, { min: 0, max: 100 }),
      progressPct: 0,
      healthScore: 75,
    },
  });

  await recordAudit({
    tenantId: tenant.id,
    actorId: actor.userId,
    actorName: actor.userName,
    entityType: "Project",
    entityId: project.id,
    action: "CREATE",
    after: { name, code: cleanCode, mode },
    source: "projects/create",
  });

  return publicRedirect(req, `/projects/${project.id}`, 303);
}
