import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireEditor } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { publicRedirect } from "@/lib/redirect";
import { parseEnumField, parseNumberField, parseStringField } from "@/lib/form-input";
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
  const status = parseEnumField(form.get("status"), VALID_STATUSES, candidate.status);
  if (!status) return NextResponse.json({ error: "invalid status" }, { status: 400 });

  const data = {
    firstName: parseStringField(form.get("firstName"), candidate.firstName) ?? candidate.firstName,
    lastName: parseStringField(form.get("lastName"), candidate.lastName) ?? candidate.lastName,
    email: parseStringField(form.get("email"), candidate.email),
    phone: parseStringField(form.get("phone"), candidate.phone),
    city: parseStringField(form.get("city"), candidate.city),
    state: parseStringField(form.get("state"), candidate.state),
    laborCategory: parseStringField(form.get("laborCategory"), candidate.laborCategory),
    primarySkill: parseStringField(form.get("primarySkill"), candidate.primarySkill),
    rateExpectation: parseNumberField(form.get("rateExpectation"), candidate.rateExpectation, { min: 0 }),
    source: parseStringField(form.get("source"), candidate.source),
    resumeUrl: parseStringField(form.get("resumeUrl"), candidate.resumeUrl),
    linkedInUrl: parseStringField(form.get("linkedInUrl"), candidate.linkedInUrl),
    notes: parseStringField(form.get("notes"), candidate.notes),
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
