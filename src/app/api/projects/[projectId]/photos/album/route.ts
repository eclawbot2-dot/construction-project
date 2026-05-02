import { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";

export async function POST(req: NextRequest, ctx: { params: Promise<{ projectId: string }> }) {
  const tenant = await requireTenant();
  const { projectId } = await ctx.params;
  const project = await prisma.project.findFirst({ where: { id: projectId, tenantId: tenant.id } });
  if (!project) redirect(`/projects/${projectId}/photos?error=project+not+found`);
  const form = await req.formData();
  const name = (form.get("name") as string | null)?.trim();
  if (!name) redirect(`/projects/${projectId}/photos?error=name+required`);
  await prisma.projectPhotoAlbum.upsert({
    where: { projectId_name: { projectId, name: name! } },
    create: { projectId, name: name! },
    update: {},
  });
  redirect(`/projects/${projectId}/photos?ok=Album+created`);
}
