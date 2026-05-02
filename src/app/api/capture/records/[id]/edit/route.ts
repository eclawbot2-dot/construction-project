import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireManager } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { publicRedirect } from "@/lib/redirect";
import { parseDateField, parseEnumField, parseNumberField, parseStringField } from "@/lib/form-input";
import { toNum } from "@/lib/money";
import { CaptureStage, SetAsideCode } from "@prisma/client";

const VALID_STAGES: CaptureStage[] = [
  "IDENTIFIED", "QUALIFYING", "CAPTURE", "PROPOSAL", "EVALUATION", "AWARDED", "LOST", "WITHDRAWN",
];
const VALID_SET_ASIDES: SetAsideCode[] = [
  "NONE", "SMALL_BUSINESS", "WOSB", "EDWOSB", "HUBZONE", "EIGHT_A", "SDVOSB",
  "TOTAL_SMALL_BUSINESS", "PARTIAL_SMALL_BUSINESS",
];

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const tenant = await requireTenant();
  const actor = await requireManager(tenant.id);

  const before = await prisma.captureRecord.findFirst({ where: { id, tenantId: tenant.id } });
  if (!before) return NextResponse.json({ error: "capture not found" }, { status: 404 });

  const form = await req.formData();
  const stage = parseEnumField(form.get("stage"), VALID_STAGES, before.stage);
  if (!stage) return NextResponse.json({ error: "invalid stage" }, { status: 400 });
  const setAside = parseEnumField(form.get("setAside"), VALID_SET_ASIDES, before.setAside);
  if (!setAside) return NextResponse.json({ error: "invalid setAside" }, { status: 400 });

  // Pass-10: enforce a forward-only progression on capture stage. Once
  // a pursuit is AWARDED or LOST, allow only the explicit terminal
  // moves; otherwise advance through the natural stage order. This
  // prevents an accidental "AWARDED → IDENTIFIED" reset that would
  // wipe win-probability tracking and confuse downstream contracts.
  // The two terminal escape hatches (LOST, WITHDRAWN) are reachable
  // from anywhere.
  const STAGE_ORDER: CaptureStage[] = ["IDENTIFIED", "QUALIFYING", "CAPTURE", "PROPOSAL", "EVALUATION", "AWARDED"];
  const TERMINAL_FROM_ANY: CaptureStage[] = ["LOST", "WITHDRAWN"];
  if (stage !== before.stage) {
    const beforeIdx = STAGE_ORDER.indexOf(before.stage);
    const targetIdx = STAGE_ORDER.indexOf(stage);
    const isForwardProgress = beforeIdx >= 0 && targetIdx >= 0 && targetIdx >= beforeIdx;
    const isTerminalEscape = TERMINAL_FROM_ANY.includes(stage);
    if (!isForwardProgress && !isTerminalEscape) {
      return NextResponse.json(
        { error: `Cannot move capture from ${before.stage} to ${stage}. Stages advance forward; terminal moves to LOST or WITHDRAWN are allowed from anywhere.` },
        { status: 400 },
      );
    }
  }

  const pwinPercent = parseNumberField(form.get("pwinPercent"), before.pwinPercent, { min: 0, max: 100 });

  await prisma.captureRecord.update({
    where: { id },
    data: {
      title: parseStringField(form.get("title"), before.title) ?? before.title,
      agency: parseStringField(form.get("agency"), before.agency),
      subAgency: parseStringField(form.get("subAgency"), before.subAgency),
      contractVehicle: parseStringField(form.get("contractVehicle"), before.contractVehicle),
      solicitationNumber: parseStringField(form.get("solicitationNumber"), before.solicitationNumber),
      naicsCode: parseStringField(form.get("naicsCode"), before.naicsCode),
      setAside,
      estimatedValue: parseNumberField(form.get("estimatedValue"), before.estimatedValue == null ? null : toNum(before.estimatedValue), { min: 0 }),
      rfpReleaseDate: parseDateField(form.get("rfpReleaseDate"), before.rfpReleaseDate),
      proposalDueDate: parseDateField(form.get("proposalDueDate"), before.proposalDueDate),
      stage,
      captureLead: parseStringField(form.get("captureLead"), before.captureLead),
      proposalLead: parseStringField(form.get("proposalLead"), before.proposalLead),
      pricingLead: parseStringField(form.get("pricingLead"), before.pricingLead),
      pwinPercent,
      winStrategy: parseStringField(form.get("winStrategy"), before.winStrategy),
      discriminators: parseStringField(form.get("discriminators"), before.discriminators),
      capturePlanUrl: parseStringField(form.get("capturePlanUrl"), before.capturePlanUrl),
      notes: parseStringField(form.get("notes"), before.notes),
    },
  });

  await recordAudit({
    tenantId: tenant.id,
    actorId: actor.userId,
    actorName: actor.userName,
    entityType: "CaptureRecord",
    entityId: id,
    action: "EDIT",
    before: { stage: before.stage, pwinPercent: before.pwinPercent },
    after: { stage, pwinPercent },
    source: "capture/records/edit",
  });

  return publicRedirect(req, `/bids/capture/${id}`, 303);
}
