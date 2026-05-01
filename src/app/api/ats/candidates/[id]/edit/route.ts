import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireEditor } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { publicRedirect } from "@/lib/redirect";
import { CandidateStatus } from "@prisma/client";

const VALID_STATUSES: CandidateStatus[] = [
  "NEW", "SCREENING", "INTERVIEWING", "OFFER", "HIRED", "REJECTED", "WITHDRAWN", "ARCHIVED",
];

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const tenant = await requireTenant();
  const actor = await requireEditor(tenant.id);

  const candidate = await prisma.candidate.findFirst({ where: { id, tenantId: tenant.id } });
  if (!candidate) return NextResponse.json({ error: "candidate not found" }, { status: 404 });

  const form = await req.formData();
  const statusRaw = String(form.get("status") ?? candidate.status);
  const status = VALID_STATUSES.includes(statusRaw as CandidateStatus)
    ? (statusRaw as CandidateStatus)
    : candidate.status;

  const data: Record<string, unknown> = {
    firstName: String(form.get("firstName") ?? candidate.firstName).trim() || candidate.firstName,
    lastName: String(form.get("lastName") ?? candidate.lastName).trim() || candidate.lastName,
    email: form.get("email") ? String(form.get("email")) : candidate.email,
    phone: form.get("phone") ? String(form.get("phone")) : candidate.phone,
    city: form.get("city") ? String(form.get("city")) : candidate.city,
    state: form.get("state") ? String(form.get("state")) : candidate.state,
    laborCategory: form.get("laborCategory") ? String(form.get("laborCategory")) : candidate.laborCategory,
    primarySkill: form.get("primarySkill") ? String(form.get("primarySkill")) : candidate.primarySkill,
    rateExpectation: form.get("rateExpectation") ? Number(form.get("rateExpectation")) : candidate.rateExpectation,
    source: form.get("source") ? String(form.get("source")) : candidate.source,
    resumeUrl: form.get("resumeUrl") ? String(form.get("resumeUrl")) : candidate.resumeUrl,
    linkedInUrl: form.get("linkedInUrl") ? String(form.get("linkedInUrl")) : candidate.linkedInUrl,
    notes: form.get("notes") ? String(form.get("notes")) : candidate.notes,
    status,
  };

  await prisma.candidate.update({ where: { id }, data });

  await recordAudit({
    tenantId: tenant.id,
    actorId: actor.userId,
    actorName: actor.userName,
    entityType: "Candidate",
    entityId: id,
    action: "EDIT",
    before: { status: candidate.status, name: `${candidate.firstName} ${candidate.lastName}` },
    after: { status, name: `${data.firstName} ${data.lastName}` },
    source: "ats/candidates/edit",
  });

  return publicRedirect(req, `/people/ats/${id}`, 303);
}
