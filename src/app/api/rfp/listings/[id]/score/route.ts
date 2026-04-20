import { NextResponse } from "next/server";
import { scoreRfpListing } from "@/lib/sales-ai";
import { requireTenant } from "@/lib/tenant";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const tenant = await requireTenant();
  const result = await scoreRfpListing(tenant.id, id);
  return NextResponse.json(result);
}
