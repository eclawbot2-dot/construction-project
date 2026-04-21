import { NextResponse } from "next/server";
import { editTimesheet } from "@/lib/timesheets";
import { requireTenant } from "@/lib/tenant";
import { publicRedirect } from "@/lib/redirect";

function numOrUndef(v: FormDataEntryValue | null): number | undefined {
  if (v === null) return undefined;
  const s = String(v).trim();
  if (!s) return undefined;
  const n = parseFloat(s);
  return isNaN(n) ? undefined : n;
}
function strOrUndef(v: FormDataEntryValue | null): string | undefined {
  if (v === null) return undefined;
  const s = String(v).trim();
  return s === "" ? undefined : s;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const tenant = await requireTenant();
  const form = await req.formData();
  const weekEndingStr = strOrUndef(form.get("weekEnding"));
  const result = await editTimesheet(id, tenant.id, {
    employeeName: strOrUndef(form.get("employeeName")),
    trade: strOrUndef(form.get("trade")),
    weekEnding: weekEndingStr ? new Date(weekEndingStr) : undefined,
    regularHours: numOrUndef(form.get("regularHours")),
    overtimeHours: numOrUndef(form.get("overtimeHours")),
    doubleTimeHours: numOrUndef(form.get("doubleTimeHours")),
    rate: numOrUndef(form.get("rate")),
    costCode: strOrUndef(form.get("costCode")),
    notes: strOrUndef(form.get("notes")),
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return publicRedirect(req, `/timesheets/${id}`, 303);
}
