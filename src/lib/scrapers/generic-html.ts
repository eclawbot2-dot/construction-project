/**
 * Generic HTML table scraper.
 *
 * Best-effort fallback for procurement portals that publish their bid
 * lists as plain HTML tables (no API, no RSS). Heuristics:
 *
 *   1. Fetch the page.
 *   2. Find every <table>.
 *   3. Inspect each table's header row. If it has a column that looks
 *      like a solicitation number / title / due date, treat it as a
 *      bid table.
 *   4. Map each <tr> to a CrawledListing using the column heuristics.
 *
 * This won't work on JS-rendered SPAs (BidNet / ConstructConnect /
 * eVA / NC eProcurement etc.) — those return a near-empty HTML shell
 * to a server-side fetch. For those, the dispatcher will return zero
 * listings and the scraper-test harness will flag them. We don't
 * fabricate; we report the truth.
 *
 * Tables with no obvious bid signals are skipped silently.
 */

import { parse, HTMLElement } from "node-html-parser";
import type { ScraperContext, CrawledListing } from "./index";

const TITLE_HEADERS = ["title", "description", "project", "name", "solicitation", "subject"];
const NUMBER_HEADERS = ["solicitation", "ifb", "rfp", "rfq", "contract no", "contract #", "project no", "project #", "bid no", "bid #", "id", "number"];
const DUE_HEADERS = ["due", "deadline", "closing", "close date", "open date", "letting date", "letting", "submission", "responses due"];
const POSTED_HEADERS = ["posted", "issued", "published", "date issued", "advertised", "release"];

export async function crawlGenericHtml(ctx: ScraperContext): Promise<CrawledListing[]> {
  const res = await fetch(ctx.source.url, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "Mozilla/5.0 (compatible; bcon-rfp-crawler/1.0)",
    },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTML fetch ${res.status} ${res.statusText}`);
  const html = await res.text();
  if (html.length < 200) throw new Error("HTML body too short to be a bid listing page");

  const root = parse(html, { lowerCaseTagName: false, comment: false });
  const tables = root.querySelectorAll("table");
  if (tables.length === 0) {
    throw new Error("No <table> found — portal is likely JS-rendered, needs portal-specific scraper");
  }

  const out: CrawledListing[] = [];
  for (const table of tables) {
    const mapped = parseTable(table, ctx);
    out.push(...mapped);
  }

  if (out.length === 0) {
    throw new Error(`Found ${tables.length} table(s) but no bid-shaped rows — needs portal-specific scraper`);
  }
  return out;
}

function parseTable(table: HTMLElement, ctx: ScraperContext): CrawledListing[] {
  const headerCells = table.querySelectorAll("thead th, tr:first-child th, tr:first-child td");
  if (headerCells.length === 0) return [];
  const headers = headerCells.map((c) => c.textContent.trim().toLowerCase());

  const titleIdx = findHeaderIdx(headers, TITLE_HEADERS);
  const numberIdx = findHeaderIdx(headers, NUMBER_HEADERS);
  const dueIdx = findHeaderIdx(headers, DUE_HEADERS);
  const postedIdx = findHeaderIdx(headers, POSTED_HEADERS);

  // Tighter heuristic: a real bid-letting table has BOTH a
  // title/description-style column AND a solicitation/contract-number
  // column. Just one of the two is too easy to false-match (calendar
  // widgets, navigation menus, generic data tables). Skip tables that
  // look like calendars (day-of-week headers).
  if (titleIdx < 0 || numberIdx < 0) return [];
  const calendarHeaders = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const calendarMatches = headers.filter((h) => calendarHeaders.includes(h)).length;
  if (calendarMatches >= 4) return [];

  const rows = table.querySelectorAll("tbody tr, tr").slice(1);
  const out: CrawledListing[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const cells = row.querySelectorAll("td");
    if (cells.length === 0) continue;
    const titleCell = titleIdx >= 0 ? cells[titleIdx] : null;
    const numberCell = numberIdx >= 0 ? cells[numberIdx] : null;
    const title = titleCell ? cleanText(titleCell.textContent) : "";
    const solicitationNo = numberCell ? cleanText(numberCell.textContent) : "";
    if (!title && !solicitationNo) continue;
    // Reject rows where the title cell looks like a bare date — common
    // false-positive on letting-schedule calendar-ish tables that
    // happen to share header keywords with bid tables.
    if (looksLikeDateOnly(title)) continue;

    const titleLink = titleCell?.querySelector("a")?.getAttribute("href") ?? null;
    const numberLink = numberCell?.querySelector("a")?.getAttribute("href") ?? null;
    const link = absoluteUrl(titleLink ?? numberLink ?? null, ctx.source.url) ?? ctx.source.url;

    const dueText = dueIdx >= 0 && cells[dueIdx] ? cleanText(cells[dueIdx].textContent) : "";
    const postedText = postedIdx >= 0 && cells[postedIdx] ? cleanText(cells[postedIdx].textContent) : "";

    const key = `${title}|${solicitationNo}|${link}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      title: (title || solicitationNo || "(untitled bid)").slice(0, 240),
      agency: ctx.catalog?.agencyName ?? ctx.source.agencyHint ?? ctx.source.label,
      solicitationNo: solicitationNo || hashKey(`${title}|${link}`),
      url: link,
      summary: cells.map((c) => cleanText(c.textContent)).join(" | ").slice(0, 1000),
      estimatedValue: null,
      dueAt: parseDate(dueText),
      postedAt: parseDate(postedText) ?? new Date(),
      setAside: null,
      naicsCode: ctx.source.naicsFilter,
      placeOfPerformance: [ctx.source.geoCity, ctx.source.geoState].filter(Boolean).join(", ") || null,
    });
  }
  return out;
}

function findHeaderIdx(headers: string[], candidates: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    for (const c of candidates) {
      if (h.includes(c)) return i;
    }
  }
  return -1;
}

function cleanText(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function looksLikeDateOnly(s: string): boolean {
  if (!s) return false;
  if (s.length > 40) return false;
  return /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(s) || /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function parseDate(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function absoluteUrl(href: string | null, base: string): string | null {
  if (!href) return null;
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

function hashKey(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return `HTML-${(h >>> 0).toString(36).toUpperCase()}`;
}
