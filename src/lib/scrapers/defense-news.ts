/**
 * defense.gov daily contract awards scraper.
 *
 * The DoD posts contracts >$7.5M as press releases at
 * https://www.defense.gov/News/Contracts/. Each release has a date
 * heading, then paragraphs per branch (Army / Navy / Air Force / DLA /
 * etc.), each paragraph announcing one award:
 *
 *   "Acme Inc., Foo, NC, was awarded a $32,000,000 firm-fixed-price
 *    contract for [scope]. Bids were solicited via [portal] with X
 *    received. Work will be performed in [location], with an
 *    estimated completion date of [date]. ... Contracting Activity
 *    is U.S. Army Corps of Engineers, Wilmington District (W912PM-...)"
 *
 * This scraper extracts each press release and turns each award
 * paragraph into a CrawledListing. Useful as a win/loss feed even
 * though awards aren't biddable — it tells the user which competitors
 * are winning what work in their NAICS / geography.
 *
 * The rendered page on defense.gov is JS-driven; the API endpoint
 * powering it lives at /News/Contracts/Contract/Article/* but
 * indexing comes from /api/MediaListing. We use the public RSS
 * fallback at /News/Contracts/RSS — yes, defense.gov publishes RSS
 * for this feed which is much more reliable than the SPA HTML.
 */

import { parse } from "node-html-parser";
import type { ScraperContext, CrawledListing } from "./index";

// In 2025/2026 defense.gov was rebranded to war.gov; the old URL 301
// redirects. The new RSS feed only contains a teaser ("contracts are
// now live on War.gov"); the actual award text lives on each article
// page at /News/Contracts/Contract/Article/<id>/, which is now Akamai-
// protected and rejects server-side fetches with HTTP 200 "Access
// Denied". Until that changes, this scraper detects the teaser and
// throws a clear error so the dispatcher can flag it. Catalog rows
// pointing here should fall back to scraperKind=MANUAL.
const RSS_URL = "https://www.war.gov/DesktopModules/ArticleCS/RSS.ashx?ContentType=400&Site=945&max=20";

type AwardChunk = {
  company: string | null;
  amount: number | null;
  scope: string;
  contractNo: string | null;
  agency: string | null;
  location: string | null;
};

export async function crawlDefenseNews(_ctx: ScraperContext): Promise<CrawledListing[]> {
  const res = await fetch(RSS_URL, {
    headers: {
      Accept: "application/rss+xml, application/xml, text/xml",
      "User-Agent": "Mozilla/5.0 (compatible; bcon-rfp-crawler/1.0)",
    },
  });
  if (!res.ok) throw new Error(`defense.gov RSS ${res.status} ${res.statusText}`);
  const xml = await res.text();
  const root = parse(xml, { lowerCaseTagName: false, comment: false });
  const items = root.querySelectorAll("item");
  if (items.length === 0) {
    throw new Error("defense.gov RSS returned no <item> entries — endpoint may have moved");
  }

  const out: CrawledListing[] = [];
  // If every item's description is the teaser-only post-rebrand
  // boilerplate, the upstream feed no longer exposes award text
  // server-side. Fail loudly so the operator knows.
  const teaserOnly = items.every((item) => {
    const desc = (item.querySelector("description")?.textContent ?? "").trim();
    return desc.length < 200 && /(now live on|are now available)/i.test(desc);
  });
  if (teaserOnly) {
    throw new Error("war.gov RSS no longer includes award text — upstream switched to Akamai-protected article pages. Mark catalog row MANUAL.");
  }
  for (const item of items) {
    const link = item.querySelector("link")?.textContent.trim() ?? "";
    const pubDate = item.querySelector("pubDate")?.textContent.trim() ?? "";
    const description = item.querySelector("description")?.textContent ?? "";
    const releaseDate = parseDate(pubDate) ?? new Date();
    const html = stripCdata(description);
    const chunks = splitAwards(html);
    for (const c of chunks) {
      if (!c.scope) continue;
      const titleParts = [c.company, c.scope.split(".")[0]].filter(Boolean);
      out.push({
        title: titleParts.join(" — ").slice(0, 240),
        agency: c.agency ?? "U.S. Department of Defense",
        solicitationNo: c.contractNo ?? `DOD-${releaseDate.toISOString().slice(0, 10)}-${out.length}`,
        url: link || `https://www.defense.gov/News/Contracts/`,
        summary: c.scope.slice(0, 1000),
        estimatedValue: c.amount,
        dueAt: null,
        postedAt: releaseDate,
        setAside: null,
        naicsCode: null,
        placeOfPerformance: c.location,
      });
    }
  }
  return out;
}

function splitAwards(html: string): AwardChunk[] {
  const text = html.replace(/<[^>]+>/g, "\n").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 80)
    // Award paragraphs always include a dollar amount and the phrase
    // "awarded a" or a contract number with the W-number / N-number /
    // FA-number pattern. Filter the meta-announcement junk out.
    .filter((p) => /\$[0-9,]+/.test(p) && /\b(awarded|contract|modification|delivery order)\b/i.test(p));
  const out: AwardChunk[] = [];
  for (const p of paragraphs) {
    out.push(parseAwardParagraph(p));
  }
  return out;
}

function parseAwardParagraph(p: string): AwardChunk {
  const amountMatch = p.match(/\$([0-9,]+)(?:\.\d+)?\s*(?:million|billion)?/i);
  let amount: number | null = null;
  if (amountMatch) {
    const raw = amountMatch[1].replace(/,/g, "");
    amount = Number(raw);
    if (/billion/i.test(amountMatch[0])) amount *= 1_000_000_000;
    else if (/million/i.test(amountMatch[0])) amount *= 1_000_000;
    if (!Number.isFinite(amount)) amount = null;
  }
  const company = p.split(",")[0]?.trim() || null;
  const contractNoMatch = p.match(/\b([A-Z0-9]{4,7}-[0-9]{2}-[A-Z]-[0-9A-Z]{4,8})\b/) || p.match(/\(([A-Z0-9-]{8,})\)/);
  const agencyMatch = p.match(/Contracting Activity is ([^.;]+?)[.;]/i) || p.match(/(U\.S\. Army[^.,;]+|U\.S\. Navy[^.,;]+|Naval[^.,;]+|Air Force[^.,;]+|Defense[^.,;]+)/);
  const locMatch = p.match(/Work will be performed in ([^.;]+?)[.;]/i);
  return {
    company,
    amount,
    scope: p,
    contractNo: contractNoMatch ? contractNoMatch[1] : null,
    agency: agencyMatch ? agencyMatch[1].trim() : null,
    location: locMatch ? locMatch[1].trim() : null,
  };
}

function parseDate(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function stripCdata(s: string): string {
  return s.replace(/^\s*<!\[CDATA\[/, "").replace(/\]\]>\s*$/, "");
}
