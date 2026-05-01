import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireEditor } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { publicRedirect } from "@/lib/redirect";
import { ColorTeamPhase } from "@prisma/client";

const VALID_PHASES: ColorTeamPhase[] = ["PINK", "RED", "GOLD", "WHITE", "BLACK", "GREEN"];

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const tenant = await requireTenant();
  const actor = await requireEditor(tenant.id);

  const capture = await prisma.captureRecord.findFirst({ where: { id, tenantId: tenant.id } });
  if (!capture) return NextResponse.json({ error: "capture not found" }, { status: 404 });

  const form = await req.formData();
  const phaseRaw = String(form.get("phase") ?? "");
  if (!VALID_PHASES.includes(phaseRaw as ColorTeamPhase)) {
    return NextResponse.json({ error: "invalid phase" }, { status: 400 });
  }
  const phase = phaseRaw as ColorTeamPhase;
  const scheduledAt = String(form.get("scheduledAt") ?? "");
  if (!scheduledAt) return NextResponse.json({ error: "scheduledAt required" }, { status: 400 });

  const review = await prisma.colorTeamReview.create({
    data: {
      captureId: id,
      phase,
      scheduledAt: new Date(scheduledAt),
      facilitator: form.get("facilitator") ? String(form.get("facilitator")) : null,
      attendees: form.get("attendees") ? String(form.get("attendees")) : null,
      scoreOverall: form.get("scoreOverall") ? Number(form.get("scoreOverall")) : null,
      summaryUrl: form.get("summaryUrl") ? String(form.get("summaryUrl")) : null,
      notes: form.get("notes") ? String(form.get("notes")) : null,
    },
  });

  await recordAudit({
    tenantId: tenant.id,
    actorId: actor.userId,
    actorName: actor.userName,
    entityType: "ColorTeamReview",
    entityId: review.id,
    action: "CREATE",
    after: { captureId: id, phase, scheduledAt },
    source: "capture/color-team/create",
  });

  return publicRedirect(req, `/bids/capture/${id}`, 303);
}
