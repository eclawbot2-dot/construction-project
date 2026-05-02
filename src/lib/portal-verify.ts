/**
 * Portal verification — exercises every auto-scraped catalog row's
 * scraper against the live upstream and writes the result back to
 * the row (lastVerifiedAt / Ok / Count / Note).
 *
 * Used by:
 *   - scripts/verify-html-scrapers.ts (CLI, ad-hoc)
 *   - /api/cron/verify-portals       (scheduled refresh)
 *   - /admin/portal-coverage refresh button (sync)
 *
 * The function is polite — runs portals in batches of 6 with native
 * fetch timeouts inside each scraper. A full pass over ~80 rows
 * takes a few minutes elapsed.
 *
 * The function does NOT touch MANUAL or DEPRECATED rows — those are
 * not supposed to work, so probing them just wastes upstream cycles.
 */

import { prisma } from "@/lib/prisma";
import { dispatchCrawl } from "@/lib/scrapers";
import type { SolicitationPortalCatalog } from "@prisma/client";

export type VerifyResult = {
  rowsProbed: number;
  passing: number;
  failing: number;
  durationMs: number;
};

export async function verifyAllPortals(): Promise<VerifyResult> {
  const start = Date.now();
  const rows = await prisma.solicitationPortalCatalog.findMany({
    where: { scraperKind: { in: ["API", "RSS", "HTML"] } },
    orderBy: [{ scraperKind: "asc" }, { name: "asc" }],
  });

  let passing = 0;
  let failing = 0;
  const batch = 6;
  for (let i = 0; i < rows.length; i += batch) {
    const slice = rows.slice(i, i + batch);
    const results = await Promise.all(
      slice.map(async (row) => {
        const fakeSource = buildFakeSource(row);
        try {
          const r = await dispatchCrawl({ source: fakeSource as never, catalog: row, keywords: [] });
          return { id: row.id, ok: r.ok && r.listings.length > 0, count: r.listings.length, note: r.note };
        } catch (err) {
          return { id: row.id, ok: false, count: 0, note: (err instanceof Error ? err.message : String(err)).slice(0, 240) };
        }
      })
    );
    const now = new Date();
    for (const r of results) {
      await prisma.solicitationPortalCatalog.update({
        where: { id: r.id },
        data: {
          lastVerifiedAt: now,
          lastVerifiedOk: r.ok,
          lastVerifiedCount: r.count,
          lastVerifiedNote: r.note?.slice(0, 240) ?? null,
        },
      });
      if (r.ok) passing += 1;
      else failing += 1;
    }
  }

  return { rowsProbed: rows.length, passing, failing, durationMs: Date.now() - start };
}

function buildFakeSource(row: SolicitationPortalCatalog) {
  return {
    id: "verify",
    tenantId: "verify",
    label: row.name,
    url: row.url,
    agencyHint: row.agencyName,
    catalogId: row.id,
    cadence: "DAILY",
    naicsFilter: row.naicsFocus?.split(",")[0]?.trim() ?? null,
    keywordsJson: "[]",
    setAsideFilter: null,
    status: "ACTIVE" as const,
    geoScope: row.geoScope,
    geoCity: row.geoCity,
    geoState: row.geoState,
    geoCountry: row.geoCountry ?? "US",
    authType: row.authType ?? "NONE",
    authUsername: null,
    authPasswordEnc: null,
    authApiKeyEnc: null,
    authCookieJar: null,
    authNotes: null,
    autoLogin: false,
    autoDraftEnabled: false,
    autoDraftMinScore: 70,
    notes: null,
    lastCheckedAt: null,
    lastCheckNote: null,
    lastResultCount: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
