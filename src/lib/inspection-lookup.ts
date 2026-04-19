/**
 * Jurisdiction inspection lookup engine.
 *
 * In a production build each jurisdiction would have its own scraper (or
 * preferably an API integration — Accela, Tyler, Clariti, and ePermitHub
 * all expose subsets). Here we provide a deterministic mock engine so
 * the whole workflow (Fetch → record → render → alert) works end-to-end
 * without external network calls, and the shape is ready for real
 * jurisdiction plugins.
 */

import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  InspectionItemStatus,
  InspectionKind,
  InspectionLookupStatus,
  InspectionResult,
  PermitStatus,
} from "@prisma/client";

export type LookupResult = {
  ok: boolean;
  fetched: number;
  created: number;
  updated: number;
  note: string;
};

type FakeInspectionRow = {
  externalId: string;
  kind: InspectionKind;
  title: string;
  scheduledAt: Date;
  completedAt: Date | null;
  result: InspectionResult;
  inspector: string;
  checklist: Array<{ title: string; codeReference?: string; status: InspectionItemStatus; notes?: string }>;
};

/** Run one lookup against a permit's jurisdiction source. */
export async function lookupPermitInspections(permitId: string): Promise<LookupResult> {
  const permit = await prisma.permit.findUnique({ where: { id: permitId } });
  if (!permit) return { ok: false, fetched: 0, created: 0, updated: 0, note: "permit not found" };
  if (!permit.autoLookupEnabled) return { ok: false, fetched: 0, created: 0, updated: 0, note: "auto-lookup disabled on this permit" };

  try {
    const rows = await fetchFromJurisdiction(permit.jurisdiction, permit.permitNumber, permit.jurisdictionUrl ?? undefined);
    let created = 0;
    let updated = 0;
    for (const row of rows) {
      const existing = await prisma.inspection.findFirst({
        where: { permitId: permit.id, externalId: row.externalId },
      });
      if (existing) {
        await prisma.inspection.update({
          where: { id: existing.id },
          data: {
            kind: row.kind,
            title: row.title,
            scheduledAt: row.scheduledAt,
            completedAt: row.completedAt,
            result: row.result,
            inspector: row.inspector,
            syncedAt: new Date(),
          },
        });
        await prisma.inspectionChecklistItem.deleteMany({ where: { inspectionId: existing.id } });
        for (let i = 0; i < row.checklist.length; i++) {
          const c = row.checklist[i];
          await prisma.inspectionChecklistItem.create({
            data: { inspectionId: existing.id, position: i, title: c.title, codeReference: c.codeReference, status: c.status, notes: c.notes },
          });
        }
        updated += 1;
      } else {
        const insp = await prisma.inspection.create({
          data: {
            projectId: permit.projectId,
            permitId: permit.id,
            kind: row.kind,
            title: row.title,
            scheduledAt: row.scheduledAt,
            completedAt: row.completedAt,
            inspector: row.inspector,
            location: permit.scopeDescription,
            result: row.result,
            followUpNeeded: row.result === "FAIL" || row.result === "CONDITIONAL",
            externalId: row.externalId,
            sourceSystem: "jurisdiction-lookup",
            syncedAt: new Date(),
          },
        });
        for (let i = 0; i < row.checklist.length; i++) {
          const c = row.checklist[i];
          await prisma.inspectionChecklistItem.create({
            data: { inspectionId: insp.id, position: i, title: c.title, codeReference: c.codeReference, status: c.status, notes: c.notes },
          });
        }
        created += 1;
      }
    }
    await prisma.permit.update({
      where: { id: permit.id },
      data: {
        lastLookupAt: new Date(),
        lastLookupStatus: InspectionLookupStatus.FETCHED,
        lastLookupNote: `fetched ${rows.length} · created ${created} · updated ${updated}`,
        status: rows.some((r) => r.result === "PASS" && r.kind === "FINAL") ? PermitStatus.FINALED : permit.status === PermitStatus.PLANNED ? PermitStatus.ISSUED : permit.status,
      },
    });
    return { ok: true, fetched: rows.length, created, updated, note: `synced ${rows.length} inspections from ${permit.jurisdiction}` };
  } catch (err) {
    await prisma.permit.update({
      where: { id: permit.id },
      data: { lastLookupAt: new Date(), lastLookupStatus: InspectionLookupStatus.ERROR, lastLookupNote: err instanceof Error ? err.message : String(err) },
    });
    return { ok: false, fetched: 0, created: 0, updated: 0, note: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Deterministic mock that mimics what a real jurisdiction scraper would return.
 * Produces 2-5 inspection rows based on a hash of the permit number so results
 * are stable between reruns for demo purposes.
 */
async function fetchFromJurisdiction(jurisdiction: string, permitNumber: string, url?: string): Promise<FakeInspectionRow[]> {
  void url;
  const hash = crypto.createHash("sha256").update(`${jurisdiction}:${permitNumber}`).digest();
  const count = 2 + (hash[0] % 4);
  const kinds: InspectionKind[] = ["PRE_POUR", "PRE_COVER", "MUNICIPAL", "THIRD_PARTY", "FINAL"];
  const results: InspectionResult[] = ["PASS", "PASS", "PASS", "CONDITIONAL", "FAIL"];
  const today = Date.now();
  const rows: FakeInspectionRow[] = [];
  for (let i = 0; i < count; i++) {
    const seed = hash[i + 1] ?? hash[0];
    const kind = kinds[seed % kinds.length];
    const result = results[seed % results.length];
    const offsetDays = 7 + i * 7;
    const scheduled = new Date(today - offsetDays * 24 * 60 * 60 * 1000);
    const completed = i < count - 1 ? scheduled : null;
    rows.push({
      externalId: `${permitNumber}-${jurisdiction}-${i + 1}`,
      kind,
      title: `${kind.replaceAll("_", " ")} inspection #${i + 1}`,
      scheduledAt: scheduled,
      completedAt: completed,
      result: completed ? result : "PENDING",
      inspector: `${jurisdiction} Inspector ${String.fromCharCode(65 + (seed % 4))}. ${["Reed", "Cruz", "Patel", "Johnson", "Kim"][seed % 5]}`,
      checklist: checklistFor(kind, seed),
    });
  }
  return rows;
}

function checklistFor(kind: InspectionKind, seed: number): Array<{ title: string; codeReference?: string; status: InspectionItemStatus; notes?: string }> {
  const base: Record<InspectionKind, Array<{ title: string; codeReference?: string }>> = {
    PRE_POUR: [
      { title: "Rebar size and clearance", codeReference: "ACI 318-19 §20.5" },
      { title: "Formwork plumb and braced", codeReference: "OSHA 1926.703" },
      { title: "Vapor barrier continuous" },
      { title: "Embeds placed per drawings" },
    ],
    PRE_COVER: [
      { title: "Rough-in plumbing pressure test", codeReference: "IPC 312" },
      { title: "Rough-in electrical secured", codeReference: "NEC 300.11" },
      { title: "Fire-blocking in place", codeReference: "IBC 718" },
    ],
    MUNICIPAL: [
      { title: "Setback conforms to site plan" },
      { title: "Grading / erosion control" },
      { title: "Driveway apron per right-of-way permit" },
    ],
    THIRD_PARTY: [
      { title: "Welds meet AWS D1.1" },
      { title: "Torque test on high-strength bolts" },
      { title: "UT/RT scan report filed" },
    ],
    FINAL: [
      { title: "Egress conforms to approved plans" },
      { title: "Smoke/CO detectors operational" },
      { title: "Grading drainage away from structure" },
      { title: "Final cleanup and site restoration" },
    ],
    INTERNAL_QC: [
      { title: "Punch walk complete" },
      { title: "Drywall finish acceptance" },
    ],
    OSHA: [
      { title: "Fall protection" },
      { title: "Housekeeping" },
      { title: "PPE compliance" },
    ],
    ENVIRONMENTAL: [
      { title: "SWPPP signage posted" },
      { title: "Silt fence intact" },
      { title: "Stockpile BMPs in place" },
    ],
  };
  const items = base[kind] ?? base.INTERNAL_QC;
  return items.map((item, i) => {
    const passRoll = (seed + i) % 10;
    const status: InspectionItemStatus = passRoll >= 8 ? "FAIL" : passRoll >= 7 ? "NA" : "PASS";
    return {
      title: item.title,
      codeReference: item.codeReference,
      status,
      notes: status === "FAIL" ? "Corrective action required; contractor to re-inspect." : undefined,
    };
  });
}
