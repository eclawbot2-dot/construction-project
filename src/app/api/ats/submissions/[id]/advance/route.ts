import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireManager } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { publicRedirect } from "@/lib/redirect";
import { SubmissionStage } from "@prisma/client";

const VALID: SubmissionStage[] = [
  "SUBMITTED",
  "RECRUITER_SCREEN",
  "TECH_SCREEN",
  "CLIENT_INTERVIEW",
  "REFERENCE_CHECK",
  "OFFER_EXTENDED",
  "OFFER_ACCEPTED",
  "OFFER_DECLINED",
  "PLACED",
  "REJECTED",
  "WITHDRAWN",
];

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const tenant = await requireTenant();
  const actor = await requireManager(tenant.id);
  const form = await req.formData();

  const stageRaw = String(form.get("stage") ?? "");
  if (!VALID.includes(stageRaw as SubmissionStage)) {
    return NextResponse.json({ error: "invalid stage" }, { status: 400 });
  }
  const stage = stageRaw as SubmissionStage;

  const submission = await prisma.submission.findFirst({
    where: { id, tenantId: tenant.id },
    include: { candidate: true },
  });
  if (!submission) return NextResponse.json({ error: "submission not found" }, { status: 404 });

  const previous = submission.stage;
  const decisionStages: SubmissionStage[] = ["OFFER_DECLINED", "PLACED", "REJECTED", "WITHDRAWN"];

  await prisma.submission.update({
    where: { id },
    data: {
      stage,
      decidedAt: decisionStages.includes(stage) ? new Date() : null,
      rejectReason: stage === "REJECTED" ? String(form.get("rejectReason") ?? "") || null : null,
    },
  });

  // Reflect terminal stages back onto the candidate's overall status.
  if (stage === "OFFER_ACCEPTED") {
    await prisma.candidate.update({ where: { id: submission.candidateId }, data: { status: "OFFER" } });
  } else if (stage === "PLACED") {
    await prisma.candidate.update({ where: { id: submission.candidateId }, data: { status: "HIRED" } });
  } else if (stage === "REJECTED") {
    await prisma.candidate.update({ where: { id: submission.candidateId }, data: { status: "REJECTED" } });
  }

  await recordAudit({
    tenantId: tenant.id,
    actorId: actor.userId,
    actorName: actor.userName,
    entityType: "Submission",
    entityId: id,
    action: "STAGE_CHANGE",
    before: { stage: previous },
    after: { stage },
    source: "ats/submissions/advance",
  });

  return publicRedirect(req, `/people/ats`, 303);
}
