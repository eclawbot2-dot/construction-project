import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { applyCoScheduleImpact } from "@/lib/schedule-impact";
import { publicRedirect } from "@/lib/redirect";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const tenant = await requireTenant();
  const co = await prisma.changeOrder.findFirst({ where: { id, project: { tenantId: tenant.id } }, include: { project: true } });
  if (!co) return NextResponse.json({ error: "CO not found" }, { status: 404 });
  const result = await applyCoScheduleImpact(co.id);
  return publicRedirect(req, `/projects/${co.projectId}/schedule`, 303);
}
