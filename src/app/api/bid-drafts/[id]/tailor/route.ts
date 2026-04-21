import { NextResponse } from "next/server";
import { tailorProposalThemes } from "@/lib/sales-ai";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { publicRedirect } from "@/lib/redirect";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const tenant = await requireTenant();
  const draft = await prisma.bidDraft.findFirst({ where: { id, tenantId: tenant.id } });
  if (!draft) return NextResponse.json({ error: "not found" }, { status: 404 });
  const tailored = await tailorProposalThemes(id);
  await prisma.bidDraft.update({
    where: { id },
    data: {
      winThemes: tailored.winThemes,
      keyDifferentiators: tailored.differentiators,
    },
  });
  return publicRedirect(req, `/bids/drafts/${id}`, 303);
}
