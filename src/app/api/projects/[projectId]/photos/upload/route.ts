import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { getStorage } from "@/lib/storage";
import { recordAudit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { publish } from "@/lib/sse";

/**
 * Upload one or more photos to a project. Multipart form-data; each
 * file becomes a ProjectPhoto row with EXIF capture data extracted
 * client-side and posted as adjacent fields (capturedAt, geoLat,
 * geoLng). Field crew mobile flow: client takes photo → uploads →
 * server stores binary + creates row.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ projectId: string }> }) {
  const tenant = await requireTenant();
  const { projectId } = await ctx.params;
  const project = await prisma.project.findFirst({ where: { id: projectId, tenantId: tenant.id } });
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });

  const form = await req.formData();
  const files = form.getAll("file") as File[];
  if (files.length === 0) return NextResponse.json({ error: "no files" }, { status: 422 });

  const albumId = (form.get("albumId") as string | null) || null;
  const caption = (form.get("caption") as string | null) || null;
  const capturedAtRaw = form.get("capturedAt") as string | null;
  const capturedAt = capturedAtRaw ? new Date(capturedAtRaw) : null;
  const geoLat = Number(form.get("geoLat"));
  const geoLng = Number(form.get("geoLng"));
  const geoAccuracyM = Number(form.get("geoAccuracyM"));

  const session = await auth();
  const storage = getStorage();
  const created: { id: string; url: string }[] = [];

  for (const f of files) {
    const buf = Buffer.from(await f.arrayBuffer());
    const put = await storage.put({
      tenantId: tenant.id,
      filename: f.name,
      body: buf,
      contentType: f.type || "image/jpeg",
    });
    const photo = await prisma.projectPhoto.create({
      data: {
        projectId,
        albumId,
        fileUrl: put.url,
        caption,
        capturedAt: capturedAt && !Number.isNaN(capturedAt.getTime()) ? capturedAt : null,
        geoLat: Number.isFinite(geoLat) ? geoLat : null,
        geoLng: Number.isFinite(geoLng) ? geoLng : null,
        geoAccuracyM: Number.isFinite(geoAccuracyM) ? geoAccuracyM : null,
        uploadedById: session?.userId ?? null,
        uploadedByName: session?.user?.name ?? null,
      },
    });
    created.push({ id: photo.id, url: put.url });
  }

  await recordAudit({
    tenantId: tenant.id,
    actorId: session?.userId ?? null,
    actorName: session?.user?.name ?? null,
    entityType: "ProjectPhoto",
    entityId: projectId,
    action: "PHOTOS_UPLOADED",
    after: { count: created.length },
    source: "api/projects/[id]/photos/upload",
  });

  publish(tenant.id, "photos", { event: "photos.uploaded", projectId, count: created.length });

  return NextResponse.json({ created });
}
