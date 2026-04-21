import { NextResponse } from "next/server";
import { draftBidFromListing } from "@/lib/bid-author";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { publicRedirect } from "@/lib/redirect";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const tenant = await requireTenant();
  const listing = await prisma.rfpListing.findFirst({ where: { id, tenantId: tenant.id } });
  if (!listing) return NextResponse.json({ error: "listing not found" }, { status: 404 });
  const draft = await draftBidFromListing({
    tenantId: tenant.id,
    listingId: listing.id,
    companyName: tenant.name,
    authorName: "AI Assistant (bcon-author-v1)",
  });
  return publicRedirect(_req, `/bids/drafts/${draft.id}`, 303);
}
