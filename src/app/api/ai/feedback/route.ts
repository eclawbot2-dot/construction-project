import { NextResponse } from "next/server";
import { recordAiFeedback } from "@/lib/ai";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";

export async function POST(req: Request) {
  const tenant = await requireTenant();
  const form = await req.formData();
  const runId = String(form.get("runId") ?? "");
  const feedback = String(form.get("feedback") ?? "").toUpperCase();
  const note = form.get("note") ? String(form.get("note")) : undefined;
  if (!runId || !["ACCEPTED", "REJECTED", "EDITED"].includes(feedback)) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }
  const run = await prisma.aiRunLog.findFirst({ where: { id: runId, tenantId: tenant.id } });
  if (!run) return NextResponse.json({ error: "not found" }, { status: 404 });
  await recordAiFeedback(runId, feedback as "ACCEPTED" | "REJECTED" | "EDITED", note);
  return NextResponse.redirect(new URL(req.headers.get("referer") ?? "/ai/meta", req.url), { status: 303 });
}
