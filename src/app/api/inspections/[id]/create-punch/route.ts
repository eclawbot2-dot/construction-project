import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { WorkflowStatus } from "@prisma/client";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const tenant = await requireTenant();
  const inspection = await prisma.inspection.findFirst({
    where: { id, project: { tenantId: tenant.id } },
    include: { project: true, checklistItems: true },
  });
  if (!inspection) return NextResponse.json({ error: "inspection not found" }, { status: 404 });

  const form = await req.formData();
  const itemId = String(form.get("itemId") ?? "");
  const item = itemId ? inspection.checklistItems.find((c) => c.id === itemId) : null;

  const title = item ? `Inspection follow-up: ${item.title}` : `Inspection follow-up: ${inspection.title}`;
  const punch = await prisma.punchItem.create({
    data: {
      projectId: inspection.projectId,
      title,
      area: inspection.location ?? undefined,
      status: WorkflowStatus.DRAFT,
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  });

  if (item) {
    await prisma.inspectionChecklistItem.update({
      where: { id: item.id },
      data: { notes: `Punch item created: ${punch.id}${item.notes ? ` | ${item.notes}` : ""}` },
    });
  } else {
    await prisma.inspection.update({
      where: { id: inspection.id },
      data: { followUpNotes: `Punch item created: ${punch.id}${inspection.followUpNotes ? ` | ${inspection.followUpNotes}` : ""}`, followUpNeeded: true },
    });
  }

  await prisma.auditEvent.create({
    data: {
      tenantId: tenant.id,
      entityType: "PunchItem",
      entityId: punch.id,
      action: "CREATED_FROM_INSPECTION",
      afterJson: JSON.stringify({ inspectionId: inspection.id, checklistItemId: item?.id ?? null }),
      source: "inspections/create-punch",
    },
  });

  const redirect = String(form.get("redirect") ?? `/projects/${inspection.projectId}/punch-list/${punch.id}`);
  return NextResponse.redirect(new URL(redirect, req.url), { status: 303 });
}
