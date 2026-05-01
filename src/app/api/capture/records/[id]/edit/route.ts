import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireManager } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { publicRedirect } from "@/lib/redirect";
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
  const stageRaw = String(form.get("stage") ?? before.stage);
  const stage = VALID_STAGES.includes(stageRaw as CaptureStage) ? (stageRaw as CaptureStage) : before.stage;
  const setAsideRaw = String(form.get("setAside") ?? before.setAside);
  const setAside = VALID_SET_ASIDES.includes(setAsideRaw as SetAsideCode) ? (setAsideRaw as SetAsideCode) : before.setAside;

  await prisma.captureRecord.update({
    where: { id },
    data: {
      title: String(form.get("title") ?? before.title).trim() || before.title,
      agency: form.get("agency") ? String(form.get("agency")) : before.agency,
      subAgency: form.get("subAgency") ? String(form.get("subAgency")) : before.subAgency,
      contractVehicle: form.get("contractVehicle") ? String(form.get("contractVehicle")) : before.contractVehicle,
      solicitationNumber: form.get("solicitationNumber") ? String(form.get("solicitationNumber")) : before.solicitationNumber,
      naicsCode: form.get("naicsCode") ? String(form.get("naicsCode")) : before.naicsCode,
      setAside,
      estimatedValue: form.get("estimatedValue") ? Number(form.get("estimatedValue")) : before.estimatedValue,
      rfpReleaseDate: form.get("rfpReleaseDate") ? new Date(String(form.get("rfpReleaseDate"))) : before.rfpReleaseDate,
      proposalDueDate: form.get("proposalDueDate") ? new Date(String(form.get("proposalDueDate"))) : before.proposalDueDate,
      stage,
      captureLead: form.get("captureLead") ? String(form.get("captureLead")) : before.captureLead,
      proposalLead: form.get("proposalLead") ? String(form.get("proposalLead")) : before.proposalLead,
      pricingLead: form.get("pricingLead") ? String(form.get("pricingLead")) : before.pricingLead,
      pwinPercent: form.get("pwinPercent") ? Number(form.get("pwinPercent")) : before.pwinPercent,
      winStrategy: form.get("winStrategy") ? String(form.get("winStrategy")) : before.winStrategy,
      discriminators: form.get("discriminators") ? String(form.get("discriminators")) : before.discriminators,
      capturePlanUrl: form.get("capturePlanUrl") ? String(form.get("capturePlanUrl")) : before.capturePlanUrl,
      notes: form.get("notes") ? String(form.get("notes")) : before.notes,
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
    after: { stage, pwinPercent: form.get("pwinPercent") ? Number(form.get("pwinPercent")) : before.pwinPercent },
    source: "capture/records/edit",
  });

  return publicRedirect(req, `/bids/capture/${id}`, 303);
}
