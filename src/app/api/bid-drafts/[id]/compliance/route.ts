import { NextResponse } from "next/server";
import { runComplianceCheck } from "@/lib/bid-author";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { publicRedirect } from "@/lib/redirect";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const tenant = await requireTenant();
  const draft = await prisma.bidDraft.findFirst({ where: { id, tenantId: tenant.id } });
  if (!draft) return NextResponse.json({ error: "draft not found" }, { status: 404 });
  const { run, passed, total, overall } = await runComplianceCheck(draft.id);
  return publicRedirect(req, `/bids/drafts/${draft.id}?run=${run.id}&passed=${passed}&total=${total}&overall=${overall}`, 303);
}
