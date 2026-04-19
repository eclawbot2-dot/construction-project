/** Minimal CSV writer with Excel BOM. */

export function toCsv(rows: Record<string, unknown>[], headers?: string[]): string {
  if (rows.length === 0 && !headers) return "";
  const cols = headers ?? Object.keys(rows[0] ?? {});
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "string" ? v : v instanceof Date ? v.toISOString() : JSON.stringify(v);
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
