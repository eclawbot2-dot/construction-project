import { NextResponse } from "next/server";
import { autopilotListing } from "@/lib/rfp-autopilot";
import { requireTenant } from "@/lib/tenant";
import { publicRedirect } from "@/lib/redirect";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const tenant = await requireTenant();
  const result = await autopilotListing(tenant.id, id, tenant.name);
  if (!result.ok) return NextResponse.json(result, { status: 404 });
  return publicRedirect(req, `/bids/drafts/${result.draftId}`, 303);
}
