import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireManager } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { publicRedirect } from "@/lib/redirect";

export async function POST(req: Request) {
  const tenant = await requireTenant();
  const actor = await requireManager(tenant.id);
  const form = await req.formData();

  const candidateId = String(form.get("candidateId") ?? "").trim();
  const startDateRaw = String(form.get("startDate") ?? "");
  if (!candidateId || !startDateRaw) {
    return NextResponse.json({ error: "candidateId and startDate required" }, { status: 400 });
  }

  const candidate = await prisma.candidate.findFirst({ where: { id: candidateId, tenantId: tenant.id } });
  if (!candidate) return NextResponse.json({ error: "candidate not found" }, { status: 404 });

  const submissionId = form.get("submissionId") ? String(form.get("submissionId")) : null;
  if (submissionId) {
    const sub = await prisma.submission.findFirst({ where: { id: submissionId, tenantId: tenant.id } });
    if (!sub) return NextResponse.json({ error: "submission not found" }, { status: 404 });
  }

  const projectId = form.get("projectId") ? String(form.get("projectId")) : null;
  if (projectId) {
    const project = await prisma.project.findFirst({ where: { id: projectId, tenantId: tenant.id } });
    if (!project) return NextResponse.json({ error: "project not in tenant" }, { status: 400 });
  }

  const placement = await prisma.placement.create({
    data: {
      tenantId: tenant.id,
      candidateId,
      submissionId,
      projectId,
      contractRef: form.get("contractRef") ? String(form.get("contractRef")) : null,
      laborCategory: form.get("laborCategory") ? String(form.get("laborCategory")) : null,
      department: form.get("department") ? String(form.get("department")) : null,
      startDate: new Date(startDateRaw),
      endDate: form.get("endDate") ? new Date(String(form.get("endDate"))) : null,
      billRate: form.get("billRate") ? Number(form.get("billRate")) : null,
      payRate: form.get("payRate") ? Number(form.get("payRate")) : null,
      status: "PENDING_START",
    },
  });

  if (submissionId) {
    await prisma.submission.update({
      where: { id: submissionId },
      data: { stage: "PLACED", decidedAt: new Date() },
    });
  }
  await prisma.candidate.update({
    where: { id: candidateId },
    data: { status: "HIRED" },
  });

  await recordAudit({
    tenantId: tenant.id,
    actorId: actor.userId,
    actorName: actor.userName,
    entityType: "Placement",
    entityId: placement.id,
    action: "CREATE",
    after: { candidateId, projectId, startDate: startDateRaw },
    source: "ats/placements/create",
  });

  return publicRedirect(req, `/people/placements`, 303);
}
