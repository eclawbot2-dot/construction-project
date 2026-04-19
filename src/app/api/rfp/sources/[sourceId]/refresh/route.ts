import { NextResponse } from "next/server";
import { crawlSourceAndPersist } from "@/lib/rfp-crawl";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";

export async function POST(_req: Request, ctx: { params: Promise<{ sourceId: string }> }) {
  const { sourceId } = await ctx.params;
  const tenant = await requireTenant();
  const source = await prisma.rfpSource.findFirst({ where: { id: sourceId, tenantId: tenant.id } });
  if (!source) return NextResponse.json({ error: "source not found" }, { status: 404 });
  const result = await crawlSourceAndPersist(source.id);
  return NextResponse.json(result);
}
