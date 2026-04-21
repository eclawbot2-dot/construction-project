import { NextResponse } from "next/server";
import { editContract } from "@/lib/record-actions";
import { requireTenant } from "@/lib/tenant";
import { publicRedirect } from "@/lib/redirect";

function str(v: FormDataEntryValue | null) { if (v === null) return undefined; const s = String(v).trim(); return s === "" ? undefined : s; }
function num(v: FormDataEntryValue | null) { if (v === null) return undefined; const s = String(v).trim(); if (!s) return undefined; const n = parseFloat(s); return isNaN(n) ? undefined : n; }
function date(v: FormDataEntryValue | null) { const s = str(v); return s ? new Date(s) : undefined; }
function bool(v: FormDataEntryValue | null) { if (v === null) return undefined; const s = String(v).trim().toLowerCase(); if (s === "") return undefined; return s === "true" || s === "on" || s === "1"; }

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const tenant = await requireTenant();
  const f = await req.formData();
  const patchRaw = {
    title: str(f.get("title")),
    subject: str(f.get("subject")),
    question: str(f.get("question")),
    description: str(f.get("description")),
    reason: str(f.get("reason")),
    amount: num(f.get("amount")),
    markupPct: num(f.get("markupPct")),
    scheduleImpactDays: num(f.get("scheduleImpactDays")),
    workCompletedToDate: num(f.get("workCompletedToDate")),
    materialsStoredToDate: num(f.get("materialsStoredToDate")),
    retainageHeld: num(f.get("retainageHeld")),
    currentPaymentDue: num(f.get("currentPaymentDue")),
    ballInCourt: str(f.get("ballInCourt")),
    dueDate: date(f.get("dueDate")),
    specSection: str(f.get("specSection")),
    longLead: bool(f.get("longLead")),
    severity: str(f.get("severity")),
    correctiveActions: str(f.get("correctiveActions")),
    area: str(f.get("area")),
    trade: str(f.get("trade")),
    assignedTo: str(f.get("assignedTo")),
    partyName: str(f.get("partyName")),
    throughDate: date(f.get("throughDate")),
    netDue: num(f.get("netDue")),
    expectedDelivery: date(f.get("expectedDelivery")),
    currentValue: num(f.get("currentValue")),
    retainagePct: num(f.get("retainagePct")),
    startDate: date(f.get("startDate")),
    endDate: date(f.get("endDate")),
    notes: str(f.get("notes")),
  };
  const patch = Object.fromEntries(Object.entries(patchRaw).filter(([, v]) => v !== undefined));
  const result = await editContract(id, tenant.id, patch);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return publicRedirect(req, req.headers.get("referer") ?? "/", 303);
}
