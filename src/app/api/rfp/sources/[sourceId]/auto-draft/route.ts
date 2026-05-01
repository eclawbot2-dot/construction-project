import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireManager } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { publicRedirect } from "@/lib/redirect";
import { parseNumberField } from "@/lib/form-input";

/**
 * Update the per-source auto-draft policy. Manager-gated.
 *
 * Form fields:
 *   autoDraftEnabled — checkbox; on/off
 *   autoDraftMinScore — 0-100; defaults to 70 if missing
 */
export async function POST(req: Request, ctx: { params: Promise<{ sourceId: string }> }) {
  const { sourceId } = await ctx.params;
  const tenant = await requireTenant();
  const actor = await requireManager(tenant.id);

  const source = await prisma.rfpSource.findFirst({ where: { id: sourceId, tenantId: tenant.id } });
  if (!source) return NextResponse.json({ error: "source not found" }, { status: 404 });

  const form = await req.formData();
  const autoDraftEnabled = form.get("autoDraftEnabled") === "on";
  const autoDraftMinScore = parseNumberField(form.get("autoDraftMinScore"), 70, { min: 0, max: 100 }) ?? 70;

  await prisma.rfpSource.update({
    where: { id: sourceId },
    data: { autoDraftEnabled, autoDraftMinScore },
  });

  await recordAudit({
    tenantId: tenant.id,
    actorId: actor.userId,
    actorName: actor.userName,
    entityType: "RfpSource",
    entityId: sourceId,
    action: "AUTO_DRAFT_CONFIG",
    before: { autoDraftEnabled: source.autoDraftEnabled, autoDraftMinScore: source.autoDraftMinScore },
    after: { autoDraftEnabled, autoDraftMinScore },
    source: "rfp/sources/auto-draft",
  });

  return publicRedirect(req, "/bids/sources", 303);
}
