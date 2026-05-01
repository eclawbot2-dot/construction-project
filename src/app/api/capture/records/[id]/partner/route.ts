import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireEditor } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { publicRedirect } from "@/lib/redirect";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const tenant = await requireTenant();
  const actor = await requireEditor(tenant.id);

  const capture = await prisma.captureRecord.findFirst({ where: { id, tenantId: tenant.id } });
  if (!capture) return NextResponse.json({ error: "capture not found" }, { status: 404 });

  const form = await req.formData();
  const partnerName = String(form.get("partnerName") ?? "").trim();
  const role = String(form.get("role") ?? "").trim();
  if (!partnerName || !role) return NextResponse.json({ error: "partnerName and role required" }, { status: 400 });

  const partner = await prisma.teamingPartner.create({
    data: {
      captureId: id,
      partnerName,
      role,
      workSharePct: form.get("workSharePct") ? Number(form.get("workSharePct")) : null,
      taSignedAt: form.get("taSignedAt") ? new Date(String(form.get("taSignedAt"))) : null,
      ndaSignedAt: form.get("ndaSignedAt") ? new Date(String(form.get("ndaSignedAt"))) : null,
      notes: form.get("notes") ? String(form.get("notes")) : null,
    },
  });

  await recordAudit({
    tenantId: tenant.id,
    actorId: actor.userId,
    actorName: actor.userName,
    entityType: "TeamingPartner",
    entityId: partner.id,
    action: "CREATE",
    after: { captureId: id, partnerName, role, workSharePct: partner.workSharePct },
    source: "capture/partner/create",
  });

  return publicRedirect(req, `/bids/capture/${id}`, 303);
}
