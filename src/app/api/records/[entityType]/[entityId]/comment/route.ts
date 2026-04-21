import { NextResponse } from "next/server";
import { logComment } from "@/lib/approvals";
import { currentActor } from "@/lib/permissions";
import { requireTenant } from "@/lib/tenant";
import { publicRedirect } from "@/lib/redirect";

export async function POST(req: Request, ctx: { params: Promise<{ entityType: string; entityId: string }> }) {
  const { entityType, entityId } = await ctx.params;
  const tenant = await requireTenant();
  const actor = await currentActor(tenant.id);
  const form = await req.formData();
  const body = String(form.get("body") ?? "").trim();
  if (!body) return NextResponse.json({ error: "comment required" }, { status: 400 });
  await logComment({ tenantId: tenant.id, entityType, entityId, actorName: actor.userName, actorId: actor.userId, kind: "COMMENT", body });
  return publicRedirect(req, req.headers.get("referer") ?? "/", 303);
}
