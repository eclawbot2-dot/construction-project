/**
 * RFP / solicitation crawler.
 *
 * Pass-11: replaces the prior deterministic mock generator with a real
 * per-portal dispatcher. The previous version hashed the source URL +
 * date and synthesized 3-7 fake listings every crawl — unacceptable in
 * production where a customer subscribing to SAM.gov would see
 * fabricated solicitation numbers that look real.
 *
 * The new contract:
 *
 *   crawlSourceAndPersist(sourceId)
 *     ↓
 *   dispatchCrawl({ source, catalog, keywords })
 *     ↓
 *   src/lib/scrapers/<scraperModule>.ts (per-portal real impl) OR
 *   { ok: false, note: "Scraper not implemented for this portal" }
 *
 * No code path generates synthetic listings.
 *
 * Real scrapers shipped as of pass-11:
 *   - sam-gov.ts       (SAM.gov Opportunities API; needs SAM_GOV_API_KEY)
 *   - generic-rss.ts   (RSS / Atom feed reader for any portal that
 *                       publishes one)
 *
 * Other catalog entries are marked scraperKind=MANUAL until per-portal
 * implementations ship; subscribing to them surfaces an explicit "not
 * yet implemented — visit the portal directly" error on the source.
 */

import { prisma } from "@/lib/prisma";
import { ProjectMode, RfpSourceStatus } from "@prisma/client";
import { dispatchCrawl } from "@/lib/scrapers";

export type CrawledListing = {
  title: string;
  agency: string;
  solicitationNo: string;
  url: string;
  summary: string;
  estimatedValue: number | null;
  dueAt: Date | null;
  postedAt: Date;
  setAside: string | null;
  naicsCode: string | null;
  placeOfPerformance: string | null;
};

export async function crawlSourceAndPersist(sourceId: string): Promise<{ ok: boolean; fetched: number; created: number; note: string }> {
  const source = await prisma.rfpSource.findUnique({
    where: { id: sourceId },
    include: { catalog: true },
  });
  if (!source) return { ok: false, fetched: 0, created: 0, note: "source not found" };

  try {
    const result = await dispatchCrawl({
      source,
      catalog: source.catalog,
      keywords: parseKeywords(source.keywordsJson),
    });

    if (!result.ok) {
      await prisma.rfpSource.update({
        where: { id: source.id },
        data: {
          lastCheckedAt: new Date(),
          lastCheckNote: result.note,
          lastResultCount: 0,
          // Manual portals stay ACTIVE so the UI doesn't hide them; real
          // failures (network, parser, missing key) flip to ERROR.
          status: result.isManual ? source.status : RfpSourceStatus.ERROR,
        },
      });
      return { ok: false, fetched: 0, created: 0, note: result.note };
    }

    // Atomic dedup via the (tenantId, agency, solicitationNo) unique
    // index. Two concurrent sweeps could otherwise both pass a
    // findFirst check before either created, leading to duplicates.
    // We try the create; the DB returns P2002 if another sweep
    // already wrote the row, in which case we update mutable fields.
    let created = 0;
    for (const row of result.listings) {
      try {
        await prisma.rfpListing.create({
          data: {
            tenantId: source.tenantId,
            sourceId: source.id,
            title: row.title,
            agency: row.agency,
            agencyKind: source.catalog?.agencyKind ?? null,
            agencyTier: source.catalog?.agencyTier ?? null,
            solicitationNo: row.solicitationNo,
            url: row.url,
            summary: row.summary,
            estimatedValue: row.estimatedValue ?? 0,
            dueAt: row.dueAt,
            postedAt: row.postedAt,
            setAside: row.setAside,
            naicsCode: row.naicsCode,
            placeOfPerformance: row.placeOfPerformance,
            matched: true,
          },
        });
        created += 1;
      } catch (err) {
        const isUniqueConflict = err instanceof Error && /Unique constraint failed/i.test(err.message);
        if (!isUniqueConflict) throw err;
        // Another sweep got there first — refresh fields the portal
        // can legitimately change between sweeps (deadline
        // extensions, amendments). Don't touch score, autoDraftedAt,
        // or status — those are owned by downstream logic.
        await prisma.rfpListing.updateMany({
          where: {
            tenantId: source.tenantId,
            agency: row.agency,
            solicitationNo: row.solicitationNo,
          },
          data: {
            dueAt: row.dueAt,
            summary: row.summary,
            estimatedValue: row.estimatedValue ?? 0,
            url: row.url,
            setAside: row.setAside,
            naicsCode: row.naicsCode,
            placeOfPerformance: row.placeOfPerformance,
          },
        });
      }
    }

    await prisma.rfpSource.update({
      where: { id: source.id },
      data: {
        lastCheckedAt: new Date(),
        lastCheckNote: `${result.note} · ${created} new`,
        lastResultCount: result.listings.length,
        status: RfpSourceStatus.ACTIVE,
      },
    });
    return { ok: true, fetched: result.listings.length, created, note: `found ${result.listings.length} · ${created} new` };
  } catch (err) {
    await prisma.rfpSource.update({
      where: { id: source.id },
      data: { lastCheckedAt: new Date(), lastCheckNote: err instanceof Error ? err.message : String(err), status: RfpSourceStatus.ERROR },
    });
    return { ok: false, fetched: 0, created: 0, note: err instanceof Error ? err.message : String(err) };
  }
}

function parseKeywords(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/** No more default mock sources. Operators subscribe via /bids/discover. */
export const DEFAULT_SOURCES: Array<{ label: string; url: string; agencyHint: string | null; cadence: string; naicsFilter: string | null; keywordsJson: string; setAsideFilter: string | null }> = [];

export function modeFromListing(l: { placeOfPerformance: string | null; title: string }): ProjectMode {
  const t = `${l.title} ${l.placeOfPerformance ?? ""}`.toLowerCase();
  if (t.includes("roadway") || t.includes("bridge") || t.includes("utility") || t.includes("pave") || t.includes("water main")) return ProjectMode.HEAVY_CIVIL;
  if (t.includes("remodel") || t.includes("renovation") || t.includes("residence")) return ProjectMode.SIMPLE;
  return ProjectMode.VERTICAL;
}
