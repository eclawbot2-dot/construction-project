import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireManager } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { publicRedirect } from "@/lib/redirect";
import { GoNoGoDecisionType, CaptureStage } from "@prisma/client";

const VALID: GoNoGoDecisionType[] = ["GO", "NO_GO", "CONDITIONAL_GO", "DEFERRED"];

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const tenant = await requireTenant();
  const actor = await requireManager(tenant.id);

  const capture = await prisma.captureRecord.findFirst({ where: { id, tenantId: tenant.id } });
  if (!capture) return NextResponse.json({ error: "capture not found" }, { status: 404 });

  const form = await req.formData();
  const decisionRaw = String(form.get("decision") ?? "");
  if (!VALID.includes(decisionRaw as GoNoGoDecisionType)) {
    return NextResponse.json({ error: "invalid decision" }, { status: 400 });
  }
  const decision = decisionRaw as GoNoGoDecisionType;
  const rationale = String(form.get("rationale") ?? "").trim();
  if (rationale.length < 3) return NextResponse.json({ error: "rationale required" }, { status: 400 });

  await prisma.goNoGoDecision.create({
    data: {
      captureId: id,
      decision,
      decidedBy: actor.userName,
      rationale,
      conditions: form.get("conditions") ? String(form.get("conditions")) : null,
      pwinAtDecision: capture.pwinPercent,
    },
  });

  // NO_GO / WITHDRAWN closes the capture; GO advances stage if still IDENTIFIED.
  if (decision === "NO_GO") {
    await prisma.captureRecord.update({ where: { id }, data: { stage: "WITHDRAWN" as CaptureStage } });
  } else if (decision === "GO" && capture.stage === "IDENTIFIED") {
    await prisma.captureRecord.update({ where: { id }, data: { stage: "QUALIFYING" } });
  }

  await recordAudit({
    tenantId: tenant.id,
    actorId: actor.userId,
    actorName: actor.userName,
    entityType: "CaptureRecord",
    entityId: id,
    action: `DECISION_${decision}`,
    after: { decision, rationale, pwin: capture.pwinPercent },
    source: "capture/decision",
  });

  return publicRedirect(req, "/bids/capture", 303);
}
