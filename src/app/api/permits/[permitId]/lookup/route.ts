import { NextResponse } from "next/server";
import { lookupPermitInspections } from "@/lib/inspection-lookup";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";

export async function POST(_req: Request, ctx: { params: Promise<{ permitId: string }> }) {
  const { permitId } = await ctx.params;
  const tenant = await requireTenant();
  const permit = await prisma.permit.findFirst({ where: { id: permitId, project: { tenantId: tenant.id } } });
  if (!permit) return NextResponse.json({ error: "permit not found" }, { status: 404 });
  const result = await lookupPermitInspections(permit.id);
  return NextResponse.json(result);
}
