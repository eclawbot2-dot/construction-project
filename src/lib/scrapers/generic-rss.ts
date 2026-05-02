/**
 * Generic RSS / Atom feed scraper.
 *
 * Many state DOT bid lettings, agency announcement boards, and some
 * aggregators publish RSS or Atom feeds. This scraper fetches the URL
 * declared on the RfpSource and parses the XML using node-html-parser
 * (which handles lenient XML well enough for RSS/Atom).
 *
 * It's deliberately minimal — extracts title, link, description, and
 * pubDate. Without portal-specific signals (NAICS, set-aside, value),
 * the resulting CrawledListing leaves those null and lets the scoring
 * engine handle the missing-signal case via partial fits.
 *
 * Used by catalog rows whose `scraperKind = RSS` and
 * `scraperModule = "generic-rss"`. Feeds with non-standard XML can get
 * their own scraper in this directory and a registry entry.
 */

import { parse } from "node-html-parser";
import type { ScraperContext, CrawledListing } from "./index";

export async function crawlGenericRss(ctx: ScraperContext): Promise<CrawledListing[]> {
  const res = await fetch(ctx.source.url, {
    headers: { Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml", "User-Agent": "bcon-rfp-crawler/1.0" },
  });
  if (!res.ok) throw new Error(`RSS fetch ${res.status} ${res.statusText}`);
  const xml = await res.text();
  if (xml.length < 32) throw new Error("RSS body too short to be a valid feed");

  // node-html-parser is HTML-oriented but tolerates well-formed XML.
  // We special-case <item> (RSS 2.0) and <entry> (Atom 1.0) tags.
  const root = parse(xml, { lowerCaseTagName: false, comment: false });
  const items = root.querySelectorAll("item");
  const entries = root.querySelectorAll("entry");
  const nodes = items.length > 0 ? items : entries;

  const out: CrawledListing[] = [];
  for (const node of nodes) {
    const title = textOf(node, "title");
    const link = linkOf(node);
    const description = textOf(node, "description") || textOf(node, "summary") || textOf(node, "content");
    const pubDate = textOf(node, "pubDate") || textOf(node, "updated") || textOf(node, "published");
    if (!title || !link) continue;
    out.push({
      title: title.slice(0, 240),
      agency: ctx.catalog?.agencyName ?? ctx.source.agencyHint ?? ctx.source.label,
      solicitationNo: extractSolicitationNo(title) ?? hashKey(link),
      url: link,
      summary: stripHtml(description).slice(0, 1000),
      estimatedValue: null,
      dueAt: null,
      postedAt: parseDate(pubDate) ?? new Date(),
      setAside: null,
      naicsCode: ctx.source.naicsFilter,
      placeOfPerformance: [ctx.source.geoCity, ctx.source.geoState].filter(Boolean).join(", ") || null,
    });
  }
  return out;
}

function textOf(node: ReturnType<typeof parse>, tag: string): string {
  const el = node.querySelector(tag);
  return el ? el.textContent.trim() : "";
}

function linkOf(node: ReturnType<typeof parse>): string {
  // RSS: <link>https://...</link>
  // Atom: <link href="https://..." rel="alternate"/>
  const linkText = textOf(node, "link");
  if (linkText && /^https?:\/\//.test(linkText)) return linkText;
  const linkEl = node.querySelector("link");
  return linkEl?.getAttribute("href") ?? "";
}

function parseDate(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function extractSolicitationNo(title: string): string | null {
  // Common patterns: "RFP-2026-0042", "IFB 26-001", "Solicitation 12345"
  const m = title.match(/\b(?:RFP|IFB|RFQ|Sol(?:icitation)?|MATOC)[\s-]?#?[\s-]?([A-Z0-9-]{4,40})\b/i);
  return m ? m[1] : null;
}

function hashKey(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return `RSS-${(h >>> 0).toString(36).toUpperCase()}`;
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
