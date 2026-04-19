import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { CostReconciliationStatus } from "@prisma/client";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const tenant = await requireTenant();
  const row = await prisma.journalEntryRow.findFirst({ where: { id, tenantId: tenant.id } });
  if (!row) return NextResponse.json({ error: "journal row not found" }, { status: 404 });

  const form = await req.formData();
  const projectId = String(form.get("projectId") ?? "");
  const costCode = String(form.get("costCode") ?? "") || null;
  const status = String(form.get("status") ?? "CONFIRMED");
  if (projectId && !(await prisma.project.findFirst({ where: { id: projectId, tenantId: tenant.id } }))) {
    return NextResponse.json({ error: "project not in this tenant" }, { status: 400 });
  }
  const validStatuses: CostReconciliationStatus[] = ["UNREVIEWED", "SUGGESTED", "CONFIRMED", "NEEDS_INPUT", "REJECTED"];
  const next: CostReconciliationStatus = validStatuses.includes(status as CostReconciliationStatus) ? (status as CostReconciliationStatus) : "CONFIRMED";

  await prisma.journalEntryRow.update({
    where: { id: row.id },
    data: {
      projectId: projectId || null,
      costCode,
      reconciliationStatus: next,
      reconciledAt: new Date(),
    },
  });

  const redirect = String(form.get("redirect") ?? "/finance/journal");
  return NextResponse.redirect(new URL(redirect, req.url), { status: 303 });
}
