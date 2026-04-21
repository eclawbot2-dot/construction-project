import { NextResponse } from "next/server";
import { createTimesheet } from "@/lib/timesheets";
import { requireTenant } from "@/lib/tenant";
import { publicRedirect } from "@/lib/redirect";

export async function POST(req: Request) {
  const tenant = await requireTenant();
  const form = await req.formData();
  const projectId = String(form.get("projectId") ?? "");
  const employeeName = String(form.get("employeeName") ?? "").trim();
  const trade = String(form.get("trade") ?? "").trim() || undefined;
  const weekEnding = String(form.get("weekEnding") ?? "");
  const regularHours = parseFloat(String(form.get("regularHours") ?? "0"));
  const overtimeHours = parseFloat(String(form.get("overtimeHours") ?? "0"));
  const doubleTimeHours = parseFloat(String(form.get("doubleTimeHours") ?? "0"));
  const rate = parseFloat(String(form.get("rate") ?? "0"));
  const costCode = String(form.get("costCode") ?? "").trim() || undefined;
  const notes = String(form.get("notes") ?? "").trim() || undefined;
  if (!projectId || !employeeName || !weekEnding) {
    return NextResponse.json({ error: "projectId, employeeName, and weekEnding required" }, { status: 400 });
  }
  const result = await createTimesheet(tenant.id, {
    projectId,
    employeeName,
    trade,
    weekEnding: new Date(weekEnding),
    regularHours,
    overtimeHours,
    doubleTimeHours,
    rate,
    costCode,
    notes,
  });
  if (!result.ok || !result.entry) return NextResponse.json({ error: result.error }, { status: 400 });
  return publicRedirect(req, `/timesheets/${result.entry.id}`, 303);
}
