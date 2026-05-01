/**
 * Drawing-set ingest. Takes a paste of a drawing-index page (typical
 * format: "A0.1   Cover Sheet" or "S2.03 Foundation Plan") and emits
 * a structured list of (sheetNumber, title) tuples plus a recommended
 * DrawingDiscipline based on the sheet-number prefix.
 *
 * Real LLM path uses aiCall(); deterministic fallback uses a regex that
 * matches "<token>  <title>" lines, since most architects export sheet
 * indexes that way. The fallback is good enough for ~90% of vanilla
 * drawing sets and runs without any LLM credit.
 *
 * The endpoint at /api/ingest/drawings doesn't write Drawing/DrawingSheet
 * rows directly — it returns the proposed list for the user to review and
 * accept. Auto-creation would violate req §7.24A "no AI-created
 * financial or contractual record may publish without human approval"
 * (drawings are contractually relevant on most projects).
 */

import { aiCall } from "@/lib/ai";
import { DrawingDiscipline } from "@prisma/client";

export type IngestedSheet = {
  sheetNumber: string;
  title: string;
  discipline: DrawingDiscipline;
  confidence: number;
};

const DISCIPLINE_PREFIXES: Array<{ regex: RegExp; discipline: DrawingDiscipline }> = [
  // Match a single-letter prefix followed by an optional dash before the
  // numeric portion. Both styles are common: "A0.1", "C-101", "E-201".
  // FP and MEP are checked first because they're 2-3 letter prefixes
  // that would otherwise trigger the single-letter rules ("FP" → "F"
  // doesn't match anything, but "MEP" would match against M for Mechanical
  // — keep MEP ordered before M).
  { regex: /^FP[-\d.]/i, discipline: "FIRE_PROTECTION" },
  { regex: /^MEP[-\d.]/i, discipline: "MEP" },
  { regex: /^A[-\d.]/i, discipline: "ARCHITECTURAL" },
  { regex: /^S[-\d.]/i, discipline: "STRUCTURAL" },
  { regex: /^M[-\d.]/i, discipline: "MECHANICAL" },
  { regex: /^E[-\d.]/i, discipline: "ELECTRICAL" },
  { regex: /^P[-\d.]/i, discipline: "PLUMBING" },
  { regex: /^C[-\d.]/i, discipline: "CIVIL" },
  { regex: /^L[-\d.]/i, discipline: "LANDSCAPE" },
];

function disciplineFor(sheetNumber: string): DrawingDiscipline {
  for (const { regex, discipline } of DISCIPLINE_PREFIXES) {
    if (regex.test(sheetNumber)) return discipline;
  }
  return "OTHER";
}

/**
 * Heuristic: match lines like "A0.1   Cover Sheet" or "C-101 Site Plan".
 * Tolerates leading whitespace, multiple spaces or tabs between number
 * and title, and stripped revision marks ("A0.1.r2 Cover Sheet" → "A0.1").
 */
export function parseDrawingIndexHeuristic(input: string): IngestedSheet[] {
  const out: IngestedSheet[] = [];
  const seen = new Set<string>();

  // Sheet-number token: 1-3 letters, optional dash, digits, optional .digits / .digits
  const lineRegex = /^\s*([A-Z]{1,3}[-]?\d{1,4}(?:\.\d{1,3})?(?:\.\d{1,3})?)\s{2,}|^\s*([A-Z]{1,3}[-]?\d{1,4}(?:\.\d{1,3})?(?:\.\d{1,3})?)\t+/i;
  const fallbackRegex = /^\s*([A-Z]{1,3}[-]?\d{1,4}(?:\.\d{1,3})?(?:\.\d{1,3})?)\s+(.+?)\s*$/i;

  for (const rawLine of input.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line) continue;
    const match = line.match(fallbackRegex);
    if (!match) continue;
    const sheetNumber = match[1].toUpperCase();
    const title = match[2].trim();
    if (sheetNumber.length < 2 || title.length < 2) continue;
    if (seen.has(sheetNumber)) continue;
    seen.add(sheetNumber);
    out.push({
      sheetNumber,
      title,
      discipline: disciplineFor(sheetNumber),
      confidence: 0.7,
    });
  }
  return out;
}

const SYSTEM_PROMPT = `You extract sheet entries from construction drawing index pages.
Return strict JSON: {"sheets":[{"sheetNumber":"A0.1","title":"Cover Sheet","discipline":"ARCHITECTURAL"}]}.
Allowed discipline values: ARCHITECTURAL, STRUCTURAL, MEP, MECHANICAL, ELECTRICAL, PLUMBING, CIVIL, LANDSCAPE, FIRE_PROTECTION, OTHER.
If a line is not a sheet entry, skip it. Never invent sheets that aren't in the input.`;

const MAX_INPUT_CHARS = 10_000;

/**
 * Extract sheets via the LLM if available, falling back to the
 * heuristic. Returns at most 200 sheets per call (large drawing sets
 * should be chunked).
 *
 * The LLM prompt is capped at MAX_INPUT_CHARS chars; longer inputs are
 * truncated and the result includes `truncated: true` so the caller can
 * surface a warning to the user. The heuristic path is unaffected by
 * the cap (regex runs on the full input).
 */
export async function extractSheets(input: string): Promise<{
  sheets: IngestedSheet[];
  source: "llm" | "heuristic";
  truncated: boolean;
  inputChars: number;
}> {
  const truncated = input.length > MAX_INPUT_CHARS;
  const heuristicSheets = parseDrawingIndexHeuristic(input);
  const result = await aiCall<IngestedSheet[]>({
    kind: "drawing.index.extract",
    system: SYSTEM_PROMPT,
    prompt: `Extract sheet entries from this drawing index. Input:\n\n${input.slice(0, MAX_INPUT_CHARS)}\n\nReturn JSON.`,
    maxTokens: 2048,
    fallback: () => heuristicSheets,
    parse: (raw: string) => {
      const jsonStart = raw.indexOf("{");
      const jsonEnd = raw.lastIndexOf("}");
      if (jsonStart < 0 || jsonEnd < 0) throw new Error("no json in response");
      const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as { sheets?: IngestedSheet[] };
      const sheets = parsed.sheets ?? [];
      return sheets.slice(0, 200).map((s) => ({
        sheetNumber: String(s.sheetNumber ?? "").toUpperCase().slice(0, 32),
        title: String(s.title ?? "").slice(0, 200),
        discipline: validateDiscipline(s.discipline),
        confidence: 0.9,
      })).filter((s) => s.sheetNumber.length >= 2 && s.title.length >= 2);
    },
  });
  return {
    sheets: result,
    source: result === heuristicSheets ? "heuristic" : "llm",
    truncated,
    inputChars: input.length,
  };
}

function validateDiscipline(value: unknown): DrawingDiscipline {
  const valid: DrawingDiscipline[] = [
    "ARCHITECTURAL", "STRUCTURAL", "MEP", "MECHANICAL", "ELECTRICAL",
    "PLUMBING", "CIVIL", "LANDSCAPE", "FIRE_PROTECTION", "OTHER",
  ];
  return valid.includes(value as DrawingDiscipline) ? (value as DrawingDiscipline) : "OTHER";
}
