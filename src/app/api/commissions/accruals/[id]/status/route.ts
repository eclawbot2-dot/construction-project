import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireManager } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { publicRedirect } from "@/lib/redirect";
import { CommissionStatus } from "@prisma/client";

const VALID: CommissionStatus[] = ["ACCRUED", "PENDING_APPROVAL", "APPROVED", "PAID", "HELD", "REVERSED"];

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const tenant = await requireTenant();
  const actor = await requireManager(tenant.id);

  const accrual = await prisma.commissionAccrual.findFirst({ where: { id, tenantId: tenant.id } });
  if (!accrual) return NextResponse.json({ error: "accrual not found" }, { status: 404 });

  const form = await req.formData();
  const targetRaw = String(form.get("status") ?? "");
  if (!VALID.includes(targetRaw as CommissionStatus)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }
  const target = targetRaw as CommissionStatus;
  const reversedReason = form.get("reversedReason") ? String(form.get("reversedReason")) : null;

  const data: Record<string, unknown> = { status: target };
  if (target === "APPROVED") {
    data.approvedAt = new Date();
    data.approvedBy = actor.userName;
  } else if (target === "PAID") {
    data.paidAt = new Date();
    data.paidBy = actor.userName;
  } else if (target === "REVERSED") {
    data.reversedAt = new Date();
    data.reversedReason = reversedReason ?? "(no reason provided)";
  }

  await prisma.commissionAccrual.update({ where: { id }, data });

  await recordAudit({
    tenantId: tenant.id,
    actorId: actor.userId,
    actorName: actor.userName,
    entityType: "CommissionAccrual",
    entityId: id,
    action: target === "APPROVED" ? "APPROVE" : target === "PAID" ? "PAY" : target === "REVERSED" ? "REVERSE" : "STATUS_CHANGE",
    before: { status: accrual.status },
    after: { status: target, reversedReason },
    source: "commissions/accruals/status",
  });

  return publicRedirect(req, "/finance/commissions", 303);
}
