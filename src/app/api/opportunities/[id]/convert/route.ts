import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireManager } from "@/lib/permissions";
import { ProjectStage } from "@prisma/client";
import { publicRedirect } from "@/lib/redirect";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const tenant = await requireTenant();
  const actor = await requireManager(tenant.id);
  const opp = await prisma.opportunity.findFirst({ where: { id, tenantId: tenant.id } });
  if (!opp) return NextResponse.json({ error: "opportunity not found" }, { status: 404 });
  if (opp.projectId) return publicRedirect(req, `/projects/${opp.projectId}`, 303);

  const form = await req.formData();
  const code = String(form.get("code") ?? "").trim() || (opp.name.split(" ").slice(0, 2).join("-").toUpperCase().replace(/[^A-Z0-9-]/g, "") + "-001");
  const defaultUnit = await prisma.businessUnit.findFirst({ where: { tenantId: tenant.id, defaultMode: opp.mode } });
  const unit = defaultUnit ?? (await prisma.businessUnit.findFirst({ where: { tenantId: tenant.id } }));

  const project = await prisma.project.create({
    data: {
      tenantId: tenant.id,
      businessUnitId: unit?.id,
      name: opp.name,
      code,
      mode: opp.mode,
      stage: ProjectStage.PRECONSTRUCTION,
      ownerName: opp.clientName ?? undefined,
      contractValue: opp.estimatedValue,
      progressPct: 0,
      healthScore: 80,
      configurationJson: JSON.stringify({ source: "opportunity", opportunityId: opp.id }),
    },
  });

  await prisma.opportunity.update({ where: { id: opp.id }, data: { projectId: project.id, awardDate: opp.awardDate ?? new Date() } });
  await prisma.auditEvent.create({
    data: {
      tenantId: tenant.id,
      actorId: actor.userId,
      entityType: "Project",
      entityId: project.id,
      action: "CREATED_FROM_OPPORTUNITY",
      afterJson: JSON.stringify({ opportunityId: opp.id, actor: actor.userName }),
      source: "opportunities/convert",
    },
  });
  return publicRedirect(req, `/projects/${project.id}`, 303);
}
