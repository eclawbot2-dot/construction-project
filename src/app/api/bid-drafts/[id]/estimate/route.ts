import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { generateEstimateForDraft } from "@/lib/estimating";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const tenant = await requireTenant();
  const draft = await prisma.bidDraft.findFirst({ where: { id, tenantId: tenant.id } });
  if (!draft) return NextResponse.json({ error: "draft not found" }, { status: 404 });
  const result = await generateEstimateForDraft(draft.id);
  return NextResponse.redirect(new URL(`/bids/drafts/${draft.id}`, req.url), { status: 303 });
}
