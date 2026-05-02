/**
 * SAM.gov real scraper.
 *
 * Hits the public SAM.gov Opportunities API:
 *   GET https://api.sam.gov/opportunities/v2/search?...&api_key=...
 *
 * Requires a free API key from open.gsa.gov, set as SAM_GOV_API_KEY in
 * .env. Without the key, returns empty results with a clear note rather
 * than fabricating data.
 *
 * Filters honored from the source row:
 *   - naicsFilter  → ncode (one or comma-list)
 *   - setAsideFilter (optional)
 *   - keywordsJson → q
 *   - geoState  → state
 *
 * Returns up to 50 listings per call; SAM.gov paginates via offset+limit
 * but for the periodic sweep one page is enough.
 */

import type { ScraperContext, CrawledListing } from "./index";

const ENDPOINT = "https://api.sam.gov/opportunities/v2/search";

type SamOpportunity = {
  noticeId?: string;
  title?: string;
  solicitationNumber?: string;
  fullParentPathName?: string;
  fullParentPathCode?: string;
  postedDate?: string;
  responseDeadLine?: string;
  description?: string;
  uiLink?: string;
  classificationCode?: string;
  naicsCode?: string;
  type?: string;
  setAside?: string;
  awardAmount?: string;
  placeOfPerformance?: { city?: { name?: string }; state?: { name?: string; code?: string } };
};

type SamResponse = {
  totalRecords?: number;
  opportunitiesData?: SamOpportunity[];
};

export async function crawlSamGov(ctx: ScraperContext): Promise<CrawledListing[]> {
  const apiKey = process.env.SAM_GOV_API_KEY;
  if (!apiKey) {
    throw new Error("SAM_GOV_API_KEY not configured (free key at https://open.gsa.gov/api/get-opportunities-public-api/)");
  }

  const params = new URLSearchParams({
    api_key: apiKey,
    limit: "50",
    postedFrom: formatSamDate(daysAgo(14)),
    postedTo: formatSamDate(new Date()),
  });

  if (ctx.source.naicsFilter) {
    // SAM accepts a single NAICS or a comma list; pass through as-is.
    params.set("ncode", ctx.source.naicsFilter);
  }
  if (ctx.source.setAsideFilter) {
    params.set("typeOfSetAside", ctx.source.setAsideFilter);
  }
  if (ctx.source.geoState) {
    params.set("state", ctx.source.geoState);
  }
  // Federal catalog rows that point at sam-gov can specify the parent
  // organization name so the SAM API filters server-side instead of
  // returning all 30k active opps. The agency name we display lives on
  // the catalog row, but the SAM API expects the SAM Org name (e.g.,
  // "DEPT OF THE NAVY"). We pass agencyHint as a candidate match —
  // SAM's organizationName accepts a partial-match by default.
  const agencyHint = ctx.catalog?.agencyName ?? ctx.source.agencyHint;
  if (agencyHint) {
    params.set("organizationName", agencyHint);
  }
  const q = ctx.keywords.join(" OR ");
  if (q) params.set("q", q);

  const res = await fetch(`${ENDPOINT}?${params.toString()}`, {
    headers: { Accept: "application/json", "User-Agent": "bcon-rfp-crawler/1.0" },
  });
  if (!res.ok) {
    throw new Error(`SAM.gov API ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as SamResponse;
  const opps = json.opportunitiesData ?? [];

  return opps.map((o) => mapOpportunity(o));
}

function mapOpportunity(o: SamOpportunity): CrawledListing {
  const place = [o.placeOfPerformance?.city?.name, o.placeOfPerformance?.state?.code].filter(Boolean).join(", ");
  const award = o.awardAmount ? Number(o.awardAmount.replace(/[$,]/g, "")) : null;
  return {
    title: (o.title ?? "(untitled)").slice(0, 240),
    agency: (o.fullParentPathName ?? "U.S. Federal").split(".")[0]?.trim() || "U.S. Federal",
    solicitationNo: o.solicitationNumber ?? o.noticeId ?? "(unknown)",
    url: o.uiLink ?? `https://sam.gov/opp/${o.noticeId ?? ""}`,
    summary: stripHtml(o.description ?? "").slice(0, 1000),
    estimatedValue: Number.isFinite(award as number) ? (award as number) : null,
    dueAt: parseSamDate(o.responseDeadLine ?? null),
    postedAt: parseSamDate(o.postedDate ?? null) ?? new Date(),
    setAside: o.setAside ?? null,
    naicsCode: o.naicsCode ?? null,
    placeOfPerformance: place || null,
  };
}

function parseSamDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatSamDate(d: Date): string {
  // SAM expects MM/DD/YYYY for postedFrom/postedTo.
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
