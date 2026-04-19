import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { applyCoScheduleImpact } from "@/lib/schedule-impact";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const tenant = await requireTenant();
  const co = await prisma.changeOrder.findFirst({ where: { id, project: { tenantId: tenant.id } }, include: { project: true } });
  if (!co) return NextResponse.json({ error: "CO not found" }, { status: 404 });
  const result = await applyCoScheduleImpact(co.id);
  return NextResponse.redirect(new URL(`/projects/${co.projectId}/schedule`, req.url), { status: 303 });
}
