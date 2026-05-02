import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { dispatchCrawl } from "@/lib/scrapers";

/**
 * Probe a source's scraper without writing listings — operator
 * confirmation that the upstream is reachable and the scraper
 * extracts something. Returns count + first listing's title.
 *
 * Distinct from /refresh, which writes listings to the DB and runs
 * the full sweep+score+autodraft pipeline. /test is read-only.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ sourceId: string }> }) {
  const { sourceId } = await ctx.params;
  const tenant = await requireTenant();
  const source = await prisma.rfpSource.findFirst({
    where: { id: sourceId, tenantId: tenant.id },
    include: { catalog: true },
  });
  if (!source) return NextResponse.json({ error: "source not found" }, { status: 404 });

  let keywords: string[] = [];
  try { keywords = JSON.parse(source.keywordsJson) as string[]; } catch { keywords = []; }

  const result = await dispatchCrawl({ source, catalog: source.catalog, keywords });
  return NextResponse.json({
    ok: result.ok,
    count: result.listings.length,
    firstTitle: result.listings[0]?.title?.slice(0, 120) ?? null,
    note: result.note,
    isManual: !result.ok && "isManual" in result ? result.isManual : false,
  });
}
