import { NextResponse } from "next/server";
import { deepComplianceCheck } from "@/lib/sales-ai";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const tenant = await requireTenant();
  const draft = await prisma.bidDraft.findFirst({ where: { id, tenantId: tenant.id } });
  if (!draft) return NextResponse.json({ error: "not found" }, { status: 404 });
  const result = await deepComplianceCheck(id);
  return NextResponse.json(result);
}
