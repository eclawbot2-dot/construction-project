import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";

/**
 * Streams a CSV of the tenant's RFP listings. Filters mirror the
 * /bids/listings UI: status, sourceId, minScore, includeBlocked. Writes
 * up to 5000 rows so a customer can pull their pipeline into Excel /
 * Sheets / Looker without paginating.
 *
 * Tenant isolation is via requireTenant — never leaks cross-tenant
 * data. Listings without a score are included unless minScore is set.
 */
export async function GET(req: NextRequest) {
  const tenant = await requireTenant();
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? undefined;
  const sourceId = url.searchParams.get("sourceId") ?? undefined;
  const minScoreStr = url.searchParams.get("minScore");
  const minScore = minScoreStr ? Number(minScoreStr) : null;
  const includeBlocked = url.searchParams.get("includeBlocked") === "1";

  const where: Record<string, unknown> = { tenantId: tenant.id };
  if (status) where.status = status;
  if (sourceId) where.sourceId = sourceId;
  if (minScore != null && Number.isFinite(minScore)) {
    where.score = { gte: minScore };
  } else if (!includeBlocked) {
    where.OR = [{ score: null }, { score: { gt: 25 } }];
  }

  const listings = await prisma.rfpListing.findMany({
    where,
    include: { source: { select: { label: true } } },
    orderBy: [{ score: "desc" }, { discoveredAt: "desc" }],
    take: 5000,
  });

  const headers = [
    "score",
    "title",
    "agency",
    "agencyKind",
    "agencyTier",
    "solicitationNo",
    "naicsCode",
    "setAside",
    "estimatedValue",
    "dueAt",
    "postedAt",
    "placeOfPerformance",
    "status",
    "autoDrafted",
    "source",
    "url",
    "discoveredAt",
  ];

  const rows = listings.map((l) => [
    l.score == null ? "" : String(l.score),
    csvField(l.title),
    csvField(l.agency),
    l.agencyKind ?? "",
    l.agencyTier ?? "",
    csvField(l.solicitationNo ?? ""),
    csvField(l.naicsCode ?? ""),
    csvField(l.setAside ?? ""),
    l.estimatedValue == null ? "" : String(l.estimatedValue),
    l.dueAt ? l.dueAt.toISOString() : "",
    l.postedAt ? l.postedAt.toISOString() : "",
    csvField(l.placeOfPerformance ?? ""),
    l.status,
    l.autoDrafted ? "1" : "0",
    csvField(l.source?.label ?? ""),
    csvField(l.url ?? ""),
    l.discoveredAt.toISOString(),
  ]);

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const filename = `bcon-listings-${tenant.slug}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}

/**
 * Quote a CSV field so commas, quotes, and newlines survive Excel and
 * any RFC 4180 reader. Always wrap in double-quotes; double up internal
 * double-quotes per the spec.
 */
function csvField(s: string): string {
  return `"${s.replace(/"/g, '""')}"`;
}
