import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticate, listEnvelope } from "../_helpers";

/**
 * GET /api/v1/listings — bid listings discovered by the tenant's
 * watched sources. Mirrors the /bids/listings UI but consumable by
 * automation.
 *
 * Auth: scope "read:listings".
 */
export async function GET(req: NextRequest) {
  const auth = await authenticate(req, "read:listings");
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "100") || 100, 1), 500);
  const status = url.searchParams.get("status");
  const minScore = Number(url.searchParams.get("min_score") ?? "");
  const since = url.searchParams.get("since"); // ISO timestamp

  const where: Record<string, unknown> = { tenantId: auth.tenantId };
  if (status) where.status = status;
  if (Number.isFinite(minScore)) where.score = { gte: minScore };
  if (since) {
    const sinceDate = new Date(since);
    if (!Number.isNaN(sinceDate.getTime())) where.discoveredAt = { gte: sinceDate };
  }

  const listings = await prisma.rfpListing.findMany({
    where,
    orderBy: [{ score: "desc" }, { discoveredAt: "desc" }],
    take: limit,
    select: {
      id: true,
      title: true,
      agency: true,
      agencyKind: true,
      agencyTier: true,
      solicitationNo: true,
      url: true,
      naicsCode: true,
      setAside: true,
      estimatedValue: true,
      placeOfPerformance: true,
      dueAt: true,
      postedAt: true,
      discoveredAt: true,
      score: true,
      autoDrafted: true,
      status: true,
    },
  });

  return listEnvelope(listings, { hasMore: listings.length === limit });
}
