import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireManager } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { publicRedirect } from "@/lib/redirect";

const DEFAULT_STEPS: Array<{ kind: string; label: string }> = [
  { kind: "DOCUMENT", label: "I-9 + W-4" },
  { kind: "DOCUMENT", label: "Direct deposit form" },
  { kind: "TRAINING", label: "Safety orientation" },
  { kind: "ACCESS_PROVISION", label: "Email + system access" },
  { kind: "EQUIPMENT", label: "Laptop + PPE issued" },
  { kind: "COMPLIANCE_CHECK", label: "Background check clear" },
  { kind: "SIGNOFF", label: "Manager final signoff" },
];

export async function POST(req: Request) {
  const tenant = await requireTenant();
  const actor = await requireManager(tenant.id);
  const form = await req.formData();

  const personName = String(form.get("personName") ?? "").trim();
  if (!personName) return NextResponse.json({ error: "personName required" }, { status: 400 });

  const candidateId = form.get("candidateId") ? String(form.get("candidateId")) : null;
  const placementId = form.get("placementId") ? String(form.get("placementId")) : null;
  const seedDefaults = form.get("seedDefaults") === "on";

  if (candidateId) {
    const c = await prisma.candidate.findFirst({ where: { id: candidateId, tenantId: tenant.id } });
    if (!c) return NextResponse.json({ error: "candidate not found" }, { status: 404 });
  }
  if (placementId) {
    const p = await prisma.placement.findFirst({ where: { id: placementId, tenantId: tenant.id } });
    if (!p) return NextResponse.json({ error: "placement not found" }, { status: 404 });
  }

  const path = await prisma.onboardingPath.create({
    data: {
      tenantId: tenant.id,
      candidateId,
      placementId,
      personName,
      role: form.get("role") ? String(form.get("role")) : null,
      startDateTarget: form.get("startDateTarget") ? new Date(String(form.get("startDateTarget"))) : null,
      ownerName: actor.userName,
      status: "PLANNED",
      ...(seedDefaults
        ? {
            steps: {
              create: DEFAULT_STEPS.map((s, i) => ({
                ordering: i + 1,
                kind: s.kind as "DOCUMENT" | "TRAINING" | "SIGNOFF" | "ACCESS_PROVISION" | "EQUIPMENT" | "COMPLIANCE_CHECK" | "ORIENTATION" | "OTHER",
                label: s.label,
              })),
            },
          }
        : {}),
    },
  });

  await recordAudit({
    tenantId: tenant.id,
    actorId: actor.userId,
    actorName: actor.userName,
    entityType: "OnboardingPath",
    entityId: path.id,
    action: "CREATE",
    after: { personName, candidateId, placementId, seedDefaults },
    source: "onboarding/paths/create",
  });

  return publicRedirect(req, "/people/onboarding", 303);
}
