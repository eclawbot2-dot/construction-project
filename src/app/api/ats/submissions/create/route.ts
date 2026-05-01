import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireEditor } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { publicRedirect } from "@/lib/redirect";

export async function POST(req: Request) {
  const tenant = await requireTenant();
  const actor = await requireEditor(tenant.id);
  const form = await req.formData();

  const candidateId = String(form.get("candidateId") ?? "").trim();
  const reqId = String(form.get("reqId") ?? "").trim();
  if (!candidateId || !reqId) return NextResponse.json({ error: "candidateId and reqId required" }, { status: 400 });

  // Validate both belong to the active tenant before linking.
  const [candidate, requisition] = await Promise.all([
    prisma.candidate.findFirst({ where: { id: candidateId, tenantId: tenant.id } }),
    prisma.jobRequisition.findFirst({ where: { id: reqId, tenantId: tenant.id } }),
  ]);
  if (!candidate) return NextResponse.json({ error: "candidate not found" }, { status: 404 });
  if (!requisition) return NextResponse.json({ error: "requisition not found" }, { status: 404 });

  const existing = await prisma.submission.findUnique({
    where: { candidateId_reqId: { candidateId, reqId } },
  });
  if (existing) {
    return NextResponse.json(
      { error: `Already submitted on ${existing.submittedAt.toISOString()} (stage: ${existing.stage}).` },
      { status: 409 },
    );
  }

  const submission = await prisma.submission.create({
    data: {
      tenantId: tenant.id,
      candidateId,
      reqId,
      stage: "SUBMITTED",
      recruiterName: actor.userName,
      rateOffered: form.get("rateOffered") ? Number(form.get("rateOffered")) : null,
      notes: form.get("notes") ? String(form.get("notes")) : null,
    },
  });

  await prisma.candidate.update({
    where: { id: candidateId },
    data: { status: "SCREENING" },
  });

  await recordAudit({
    tenantId: tenant.id,
    actorId: actor.userId,
    actorName: actor.userName,
    entityType: "Submission",
    entityId: submission.id,
    action: "CREATE",
    after: { candidateId, reqId, stage: "SUBMITTED" },
    source: "ats/submissions/create",
  });

  return publicRedirect(req, `/people/ats`, 303);
}
