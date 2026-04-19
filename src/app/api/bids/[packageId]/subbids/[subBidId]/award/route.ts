import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { awardSubBid } from "@/lib/subcontract-award";

export async function POST(req: Request, ctx: { params: Promise<{ packageId: string; subBidId: string }> }) {
  const { packageId, subBidId } = await ctx.params;
  const tenant = await requireTenant();
  const pkg = await prisma.bidPackage.findFirst({ where: { id: packageId, project: { tenantId: tenant.id } } });
  if (!pkg) return NextResponse.json({ error: "bid package not found" }, { status: 404 });
  const result = await awardSubBid(subBidId, tenant.id);
  if (!result.ok) return NextResponse.json({ error: result.note }, { status: 400 });
  return NextResponse.redirect(new URL(`/projects/${pkg.projectId}/contracts/${result.contractId}`, req.url), { status: 303 });
}
