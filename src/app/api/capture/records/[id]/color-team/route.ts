import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireEditor } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { publicRedirect } from "@/lib/redirect";
import { parseDateField, parseEnumField, parseNumberField, parseStringField } from "@/lib/form-input";
import { ColorTeamPhase } from "@prisma/client";

const VALID_PHASES: ColorTeamPhase[] = ["PINK", "RED", "GOLD", "WHITE", "BLACK", "GREEN"];

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const tenant = await requireTenant();
  const actor = await requireEditor(tenant.id);

  const capture = await prisma.captureRecord.findFirst({ where: { id, tenantId: tenant.id } });
  if (!capture) return NextResponse.json({ error: "capture not found" }, { status: 404 });

  const form = await req.formData();
  // The form provides a default phase, so empty submission is invalid
  // (we never expect the field to be missing). parseEnumField returns
  // null on a malformed-but-non-empty value; we reject those.
  const phaseRaw = parseStringField(form.get("phase"), null);
  const phase = phaseRaw && VALID_PHASES.includes(phaseRaw as ColorTeamPhase) ? (phaseRaw as ColorTeamPhase) : null;
  if (!phase) return NextResponse.json({ error: "invalid phase" }, { status: 400 });

  const scheduledAt = parseDateField(form.get("scheduledAt"), null);
  if (!scheduledAt) return NextResponse.json({ error: "scheduledAt required" }, { status: 400 });

  const review = await prisma.colorTeamReview.create({
    data: {
      captureId: id,
      phase,
      scheduledAt,
      facilitator: parseStringField(form.get("facilitator"), null),
      attendees: parseStringField(form.get("attendees"), null),
      scoreOverall: parseNumberField(form.get("scoreOverall"), null, { min: 0, max: 100 }),
      summaryUrl: parseStringField(form.get("summaryUrl"), null),
      notes: parseStringField(form.get("notes"), null),
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
