import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireEditor } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { publicRedirect } from "@/lib/redirect";
import { OnboardingStepStatus } from "@prisma/client";

const VALID: OnboardingStepStatus[] = ["PENDING", "IN_PROGRESS", "WAIVED", "COMPLETE", "BLOCKED"];

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const tenant = await requireTenant();
  const actor = await requireEditor(tenant.id);
  const form = await req.formData();

  const targetRaw = String(form.get("status") ?? "");
  if (!VALID.includes(targetRaw as OnboardingStepStatus)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }
  const target = targetRaw as OnboardingStepStatus;

  const step = await prisma.onboardingStep.findFirst({
    where: { id, path: { tenantId: tenant.id } },
    include: { path: true },
  });
  if (!step) return NextResponse.json({ error: "step not found" }, { status: 404 });

  // Only managers can WAIVE a required step.
  if (target === "WAIVED" && step.required && !actor.isManager) {
    return NextResponse.json({ error: "only managers can waive a required step" }, { status: 403 });
  }

  await prisma.onboardingStep.update({
    where: { id },
    data: {
      status: target,
      completedAt: target === "COMPLETE" || target === "WAIVED" ? new Date() : null,
      completedBy: target === "COMPLETE" || target === "WAIVED" ? actor.userName : null,
      blocker: target === "BLOCKED" ? String(form.get("blocker") ?? "(no detail)") : null,
    },
  });

  // If every required step is now COMPLETE or WAIVED, close the path.
  const remaining = await prisma.onboardingStep.count({
    where: {
      pathId: step.pathId,
      required: true,
      status: { notIn: ["COMPLETE", "WAIVED"] },
    },
  });
  if (remaining === 0 && step.path.status !== "COMPLETED") {
    await prisma.onboardingPath.update({
      where: { id: step.pathId },
      data: { status: "COMPLETED" },
    });
  } else if (step.path.status === "PLANNED" && target !== "PENDING") {
    await prisma.onboardingPath.update({
      where: { id: step.pathId },
      data: { status: "IN_PROGRESS" },
    });
  }

  await recordAudit({
    tenantId: tenant.id,
    actorId: actor.userId,
    actorName: actor.userName,
    entityType: "OnboardingStep",
    entityId: id,
    action: target,
    before: { status: step.status },
    after: { status: target },
    source: "onboarding/steps/status",
  });

  return publicRedirect(req, "/people/onboarding", 303);
}
