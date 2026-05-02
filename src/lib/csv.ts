/**
 * Minimal CSV writer with Excel BOM and formula-injection defense.
 *
 * Cells starting with `=`, `+`, `-`, `@`, tab, or carriage-return are
 * prefixed with a leading single quote so Excel/Sheets/Numbers render
 * them as text rather than evaluating as formulas. This is the OWASP
 * recommended mitigation for CSV injection.
 */

const FORMULA_LEAD = /^[=+\-@\t\r]/;

/** Always-quoted field with formula defense \u2014 use for any user-supplied
 *  cell value where Excel-execution risk exists. Returns the cell with
 *  RFC 4180 double-quote wrapping (and inner double-quote doubling). */
export function csvField(s: string): string {
  const defanged = s.length > 0 && FORMULA_LEAD.test(s) ? `'${s}` : s;
  return `"${defanged.replace(/"/g, '""')}"`;
}

export function toCsv(rows: Record<string, unknown>[], headers?: string[]): string {
  if (rows.length === 0 && !headers) return "";
  const cols = headers ?? Object.keys(rows[0] ?? {});
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return "";
    let s = typeof v === "string" ? v : v instanceof Date ? v.toISOString() : JSON.stringify(v);
    // Formula-injection defense \u2014 prefix unsafe leaders with a single
    // quote so the cell is treated as text, not formula.
    if (s.length > 0 && FORMULA_LEAD.test(s)) s = `'${s}`;
    if (/[",\n]/.test(s)) return `"${s.replaceAll(/"/g, '""')}"`;
    return s;
  };
  const head = cols.join(",");
  const body = rows.map((r) => cols.map((c) => escape((r as Record<string, unknown>)[c])).join(",")).join("\n");
  return `\uFEFF${head}\n${body}`;
}

export function csvResponse(filename: string, csv: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
