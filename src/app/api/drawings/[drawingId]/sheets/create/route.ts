import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireEditor } from "@/lib/permissions";
import { publicRedirect } from "@/lib/redirect";

export async function POST(req: Request, ctx: { params: Promise<{ drawingId: string }> }) {
  const { drawingId } = await ctx.params;
  const tenant = await requireTenant();
  await requireEditor(tenant.id);

  const drawing = await prisma.drawing.findFirst({
    where: { id: drawingId, project: { tenantId: tenant.id } },
  });
  if (!drawing) return NextResponse.json({ error: "drawing not found" }, { status: 404 });

  const form = await req.formData();
  const sheetNumber = String(form.get("sheetNumber") ?? "").trim();
  const title = String(form.get("title") ?? "").trim();
  if (!sheetNumber || !title) {
    return NextResponse.json({ error: "sheetNumber and title required" }, { status: 400 });
  }

  await prisma.drawingSheet.upsert({
    where: { drawingId_sheetNumber: { drawingId, sheetNumber } },
    create: {
      drawingId,
      sheetNumber,
      title,
      pageNumber: form.get("pageNumber") ? Number(form.get("pageNumber")) : null,
      fileUrl: form.get("fileUrl") ? String(form.get("fileUrl")) : null,
    },
    update: { title, isCurrent: true },
  });

  return publicRedirect(req, `/projects/${drawing.projectId}/drawings`, 303);
}
