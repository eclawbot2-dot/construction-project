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

export async function POST(req: Request) {
  const tenant = await requireTenant();
  const actor = await requireManager(tenant.id);
  const form = await req.formData();

  const title = String(form.get("title") ?? "").trim();
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

  const stageRaw = String(form.get("stage") ?? "IDENTIFIED");
  const stage = VALID_STAGES.includes(stageRaw as CaptureStage) ? (stageRaw as CaptureStage) : "IDENTIFIED";

  const setAsideRaw = String(form.get("setAside") ?? "NONE");
  const setAside = VALID_SET_ASIDES.includes(setAsideRaw as SetAsideCode) ? (setAsideRaw as SetAsideCode) : "NONE";

  const record = await prisma.captureRecord.create({
    data: {
      tenantId: tenant.id,
      title,
      agency: form.get("agency") ? String(form.get("agency")) : null,
      contractVehicle: form.get("contractVehicle") ? String(form.get("contractVehicle")) : null,
      solicitationNumber: form.get("solicitationNumber") ? String(form.get("solicitationNumber")) : null,
      naicsCode: form.get("naicsCode") ? String(form.get("naicsCode")) : null,
      setAside,
      estimatedValue: form.get("estimatedValue") ? Number(form.get("estimatedValue")) : null,
      proposalDueDate: form.get("proposalDueDate") ? new Date(String(form.get("proposalDueDate"))) : null,
      stage,
      captureLead: form.get("captureLead") ? String(form.get("captureLead")) : null,
      proposalLead: form.get("proposalLead") ? String(form.get("proposalLead")) : null,
      pwinPercent: form.get("pwinPercent") ? Number(form.get("pwinPercent")) : null,
      winStrategy: form.get("winStrategy") ? String(form.get("winStrategy")) : null,
    },
  });

  await recordAudit({
    tenantId: tenant.id,
    actorId: actor.userId,
    actorName: actor.userName,
    entityType: "CaptureRecord",
    entityId: record.id,
    action: "CREATE",
    after: { title, agency: record.agency, stage },
    source: "capture/records/create",
  });

  return publicRedirect(req, "/bids/capture", 303);
}
