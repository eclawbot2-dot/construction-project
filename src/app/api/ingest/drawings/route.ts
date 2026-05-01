import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireEditor } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { extractSheets } from "@/lib/drawing-ingest";
import { parseEnumField, parseStringField } from "@/lib/form-input";
import { DrawingDiscipline } from "@prisma/client";

const VALID_DISCIPLINES: DrawingDiscipline[] = [
  "ARCHITECTURAL", "STRUCTURAL", "MEP", "MECHANICAL", "ELECTRICAL",
  "PLUMBING", "CIVIL", "LANDSCAPE", "FIRE_PROTECTION", "OTHER",
];

/**
 * Drawing-set ingest endpoint. Accepts a paste of a drawing index page
 * and (optionally) auto-creates a Drawing + DrawingSheet rows for the
 * proposed entries.
 *
 * Two modes:
 *   action=preview  → returns the proposed sheet list as JSON without
 *                     touching the database. Used by the UI to render
 *                     a review table before commit.
 *   action=commit   → creates the Drawing row and the proposed sheets.
 *                     Honours req §7.24A: human approval gates the
 *                     publish step, even though the extraction is AI.
 *
 * Source attribution lands in AuditEvent so we can later compute
 * accept rates per LLM provider vs heuristic.
 */
export async function POST(req: Request) {
  const tenant = await requireTenant();
  const actor = await requireEditor(tenant.id);
  const form = await req.formData();

  const projectId = parseStringField(form.get("projectId"), null);
  const setName = parseStringField(form.get("setName"), null);
  const text = parseStringField(form.get("text"), null);
  if (!projectId || !setName || !text) {
    return NextResponse.json({ error: "projectId, setName, and text required" }, { status: 400 });
  }

  const project = await prisma.project.findFirst({ where: { id: projectId, tenantId: tenant.id } });
  if (!project) return NextResponse.json({ error: "project not in tenant" }, { status: 404 });

  const action = String(form.get("action") ?? "preview");
  const discipline = parseEnumField(form.get("discipline"), VALID_DISCIPLINES, "OTHER" as DrawingDiscipline) ?? "OTHER";

  const { sheets, source } = await extractSheets(text);

  if (action === "preview") {
    return NextResponse.json({
      ok: true,
      source,
      proposed: sheets,
      stats: { count: sheets.length, byDiscipline: countBy(sheets.map((s) => s.discipline)) },
    });
  }

  // commit path
  const drawing = await prisma.drawing.create({
    data: {
      projectId,
      setName,
      discipline,
      revisionNumber: Number(form.get("revisionNumber") ?? 0) || 0,
      issuedDate: form.get("issuedDate") ? new Date(String(form.get("issuedDate"))) : null,
      notes: `AI-ingested from ${source}; ${sheets.length} sheet${sheets.length === 1 ? "" : "s"} accepted.`,
    },
  });

  // upsert sheet rows so a re-run doesn't duplicate.
  for (const s of sheets) {
    await prisma.drawingSheet.upsert({
      where: { drawingId_sheetNumber: { drawingId: drawing.id, sheetNumber: s.sheetNumber } },
      create: { drawingId: drawing.id, sheetNumber: s.sheetNumber, title: s.title },
      update: { title: s.title },
    });
  }

  await recordAudit({
    tenantId: tenant.id,
    actorId: actor.userId,
    actorName: actor.userName,
    entityType: "Drawing",
    entityId: drawing.id,
    action: "AI_INGEST",
    after: { setName, discipline, sheetCount: sheets.length, source },
    source: "ingest/drawings",
  });

  return NextResponse.json({
    ok: true,
    source,
    drawing: { id: drawing.id, setName, discipline },
    sheetsCreated: sheets.length,
  });
}

function countBy(values: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of values) out[v] = (out[v] ?? 0) + 1;
  return out;
}
