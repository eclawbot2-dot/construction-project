/**
 * Per-portal scraper dispatcher.
 *
 * Pass-11: replaces the deterministic mock crawler. The previous
 * implementation in src/lib/rfp-crawl.ts:crawlSource generated
 * plausible-looking fake listings for every source regardless of
 * portal. That's a credibility risk if a real customer subscribes to
 * SAM.gov and sees fabricated solicitations with realistic numbers.
 *
 * The new contract:
 *
 *   1. Each RfpSource has an optional `catalogId` pointing at a row in
 *      SolicitationPortalCatalog.
 *   2. The catalog row declares `scraperKind` (API/RSS/HTML/MANUAL) and
 *      `scraperModule` naming the implementation file.
 *   3. dispatchCrawl() resolves the module and runs it. Sources without
 *      a catalog backing — or backed by a MANUAL/DEPRECATED catalog
 *      row — get a clear "scraper not implemented" result instead of
 *      mock data.
 *
 * Each scraper module exports `crawl(source): Promise<CrawledListing[]>`
 * — a pure function that returns whatever real listings it can fetch,
 * or throws if the portal is unreachable.
 */

import type { RfpSource, SolicitationPortalCatalog } from "@prisma/client";
import { crawlSamGov } from "./sam-gov";
import { crawlGenericRss } from "./generic-rss";
import { crawlGenericHtml } from "./generic-html";
import { crawlDefenseNews } from "./defense-news";

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

export type ScraperContext = {
  source: RfpSource;
  catalog: SolicitationPortalCatalog | null;
  keywords: string[];
};

export type ScraperResult =
  | { ok: true; listings: CrawledListing[]; note: string }
  | { ok: false; listings: []; note: string; isManual?: boolean };

type ScraperImpl = (ctx: ScraperContext) => Promise<CrawledListing[]>;

/**
 * Registry of real scraper implementations. Keyed by the
 * `scraperModule` value declared on the catalog row.
 */
const REGISTRY: Record<string, ScraperImpl> = {
  "sam-gov": crawlSamGov,
  "generic-rss": crawlGenericRss,
  "generic-html": crawlGenericHtml,
  "defense-news": crawlDefenseNews,
};

/**
 * Resolve and run the scraper for a source. Returns a structured
 * result; never throws.
 */
export async function dispatchCrawl(ctx: ScraperContext): Promise<ScraperResult> {
  const { catalog } = ctx;

  if (!catalog) {
    return {
      ok: false,
      listings: [],
      note: "Source has no catalog backing — manual subscription only. Subscribe via /bids/discover so the scraper dispatcher knows which integration to use.",
      isManual: true,
    };
  }

  if (catalog.scraperKind === "MANUAL") {
    return {
      ok: false,
      listings: [],
      note: `Scraper not yet implemented for ${catalog.name}. Visit ${catalog.url} directly to monitor this portal until an integration ships.`,
      isManual: true,
    };
  }

  if (catalog.scraperKind === "DEPRECATED") {
    return {
      ok: false,
      listings: [],
      note: `${catalog.name} is marked deprecated. Disable this source or pick a replacement from the catalog.`,
      isManual: true,
    };
  }

  const moduleName = catalog.scraperModule ?? "";
  const impl = REGISTRY[moduleName];
  if (!impl) {
    return {
      ok: false,
      listings: [],
      note: `Scraper module "${moduleName}" referenced by catalog row but not registered. Add an entry to src/lib/scrapers/index.ts:REGISTRY.`,
    };
  }

  try {
    const listings = await impl(ctx);
    return {
      ok: true,
      listings,
      note: `Scraped ${listings.length} listing${listings.length === 1 ? "" : "s"} via ${catalog.scraperKind.toLowerCase()} (${moduleName}).`,
    };
  } catch (err) {
    return {
      ok: false,
      listings: [],
      note: `Scraper error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/** Names of registered scraper modules — for the discover UI to show
 *  which catalog entries actually have implementations behind them. */
export function registeredScraperModules(): string[] {
  return Object.keys(REGISTRY);
}
