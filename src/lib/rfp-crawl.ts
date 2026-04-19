/**
 * RFP / solicitation crawler.
 *
 * Each tenant registers watched sources (SAM.gov searches, DOT bid boards,
 * city procurement pages, Dodge/PlanHub saved searches, etc). The runtime
 * fetches each on a cadence, diffs against stored listings, and surfaces
 * new matches.
 *
 * Here we provide a deterministic mock crawler so the whole workflow
 * works end to end. Replace `crawlSource` with a real fetch+parser per
 * source when the integration is wired.
 */

import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { ProjectMode, RfpSourceStatus } from "@prisma/client";

type CrawledListing = {
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
  const source = await prisma.rfpSource.findUnique({ where: { id: sourceId } });
  if (!source) return { ok: false, fetched: 0, created: 0, note: "source not found" };
  try {
    const rows = await crawlSource(source.url, source.agencyHint, parseKeywords(source.keywordsJson), source.naicsFilter, source.setAsideFilter);
    let created = 0;
    for (const row of rows) {
      const existing = await prisma.rfpListing.findFirst({
        where: { tenantId: source.tenantId, solicitationNo: row.solicitationNo, agency: row.agency },
      });
      if (existing) continue;
      await prisma.rfpListing.create({
        data: {
          tenantId: source.tenantId,
          sourceId: source.id,
          title: row.title,
          agency: row.agency,
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
    }
    await prisma.rfpSource.update({
      where: { id: source.id },
      data: {
        lastCheckedAt: new Date(),
        lastCheckNote: `fetched ${rows.length} · ${created} new`,
        lastResultCount: rows.length,
        status: RfpSourceStatus.ACTIVE,
      },
    });
    return { ok: true, fetched: rows.length, created, note: `found ${rows.length} · ${created} new` };
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

async function crawlSource(sourceUrl: string, agencyHint: string | null, keywords: string[], naicsFilter: string | null, setAsideFilter: string | null): Promise<CrawledListing[]> {
  const hash = crypto.createHash("sha256").update(`${sourceUrl}:${new Date().toISOString().slice(0, 10)}`).digest();
  const count = 3 + (hash[0] % 5);
  const naics = naicsFilter ?? ["236220", "237110", "237310", "237990"][hash[1] % 4];
  const setAside = setAsideFilter ?? ["none", "SDVOSB", "8(a)", "WOSB", "Small Business"][hash[2] % 5];
  const agency = agencyHint ?? ["SCDOT", "City of Charleston", "Mt Pleasant Water", "Naval Facilities Command", "GSA"][hash[3] % 5];
  const words = keywords.length > 0 ? keywords : ["construction", "utility", "renovation", "civil", "vertical"];
  const rows: CrawledListing[] = [];
  for (let i = 0; i < count; i++) {
    const sol = `RFP-${agency.replace(/[^A-Z]/g, "").padEnd(4, "X").slice(0, 4)}-${new Date().getFullYear()}-${(hash[4 + i] % 900 + 100).toString()}`;
    const ev = 250_000 * ((hash[5 + i] ?? hash[0]) % 40 + 1);
    const dueOffsetDays = 14 + ((hash[6 + i] ?? hash[1]) % 30);
    const topic = words[(hash[7 + i] ?? hash[2]) % words.length];
    rows.push({
      title: `${agency} — ${topic} — ${["services", "package", "task order", "upgrade"][(hash[8 + i] ?? hash[0]) % 4]}`,
      agency,
      solicitationNo: sol,
      url: `${sourceUrl.replace(/\/$/, "")}/solicitation/${sol}`,
      summary: `${agency} is soliciting bids for a ${topic} project. NAICS ${naics}. See full solicitation for instructions to bidders, site visit requirements, and addenda.`,
      estimatedValue: ev,
      dueAt: new Date(Date.now() + dueOffsetDays * 24 * 60 * 60 * 1000),
      postedAt: new Date(Date.now() - (((hash[9 + i] ?? hash[0]) % 5) + 1) * 24 * 60 * 60 * 1000),
      setAside: setAside === "none" ? null : setAside,
      naicsCode: naics,
      placeOfPerformance: ["Charleston, SC", "Mt Pleasant, SC", "North Charleston, SC", "Columbia, SC"][(hash[10 + i] ?? hash[0]) % 4],
    });
  }
  return rows;
}

/** Default sources seeded for every new tenant. */
export const DEFAULT_SOURCES: Array<Pick<{ label: string; url: string; agencyHint: string | null; cadence: string; naicsFilter: string | null; keywordsJson: string; setAsideFilter: string | null }, "label" | "url" | "agencyHint" | "cadence" | "naicsFilter" | "keywordsJson" | "setAsideFilter">> = [
  { label: "SAM.gov — Construction 236220", url: "https://sam.gov/search", agencyHint: "SAM.gov", cadence: "DAILY", naicsFilter: "236220", keywordsJson: JSON.stringify(["construction", "renovation"]), setAsideFilter: null },
  { label: "SCDOT Bid Board", url: "https://www.scdot.org/business/business-letting.aspx", agencyHint: "SCDOT", cadence: "WEEKLY", naicsFilter: "237310", keywordsJson: JSON.stringify(["roadway", "bridge", "utility"]), setAsideFilter: null },
  { label: "City of Charleston Procurement", url: "https://www.charleston-sc.gov/bids.aspx", agencyHint: "City of Charleston", cadence: "DAILY", naicsFilter: null, keywordsJson: JSON.stringify(["facility", "construction", "renovation"]), setAsideFilter: null },
  { label: "NAVFAC SE Construction", url: "https://www.navfac.navy.mil/navfac_worldwide/atlantic.html", agencyHint: "NAVFAC Atlantic", cadence: "WEEKLY", naicsFilter: "236220", keywordsJson: JSON.stringify(["construction", "MACC"]), setAsideFilter: "SDVOSB" },
];

export function modeFromListing(l: { placeOfPerformance: string | null; title: string }): ProjectMode {
  const t = `${l.title} ${l.placeOfPerformance ?? ""}`.toLowerCase();
  if (t.includes("roadway") || t.includes("bridge") || t.includes("utility") || t.includes("pave") || t.includes("water main")) return ProjectMode.HEAVY_CIVIL;
  if (t.includes("remodel") || t.includes("renovation") || t.includes("residence") || t.includes("remodel")) return ProjectMode.SIMPLE;
  return ProjectMode.VERTICAL;
}
