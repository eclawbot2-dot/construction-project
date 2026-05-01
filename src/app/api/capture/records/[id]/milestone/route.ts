import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireEditor } from "@/lib/permissions";
import { publicRedirect } from "@/lib/redirect";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const tenant = await requireTenant();
  await requireEditor(tenant.id);

  const capture = await prisma.captureRecord.findFirst({ where: { id, tenantId: tenant.id } });
  if (!capture) return NextResponse.json({ error: "capture not found" }, { status: 404 });

  const form = await req.formData();
  const label = String(form.get("label") ?? "").trim();
  const dueAt = String(form.get("dueAt") ?? "");
  if (!label || !dueAt) return NextResponse.json({ error: "label and dueAt required" }, { status: 400 });

  await prisma.captureMilestone.create({
    data: {
      captureId: id,
      label,
      dueAt: new Date(dueAt),
      ownerName: form.get("ownerName") ? String(form.get("ownerName")) : null,
    },
  });

  return publicRedirect(req, "/bids/capture", 303);
}
