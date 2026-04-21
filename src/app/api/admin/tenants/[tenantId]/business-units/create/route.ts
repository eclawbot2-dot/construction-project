import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/permissions";
import { publicRedirect } from "@/lib/redirect";
import type { ProjectMode } from "@prisma/client";

export async function POST(req: Request, ctx: { params: Promise<{ tenantId: string }> }) {
  const admin = await requireSuperAdmin();
  const { tenantId } = await ctx.params;
  const form = await req.formData();
  const name = String(form.get("name") ?? "").trim();
  const code = String(form.get("code") ?? "").trim().toUpperCase();
  const defaultMode = String(form.get("defaultMode") ?? "VERTICAL") as ProjectMode;
  const region = String(form.get("region") ?? "").trim() || null;
  if (!name || !code) return NextResponse.json({ error: "name + code required" }, { status: 400 });
  try {
    const bu = await prisma.businessUnit.create({ data: { tenantId, name, code, defaultMode, region } });
    await prisma.auditEvent.create({
      data: { tenantId, actorId: admin.userId, entityType: "BusinessUnit", entityId: bu.id, action: "BUSINESS_UNIT_CREATED", afterJson: JSON.stringify({ name, code }), source: "admin/bu-create" },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "create failed" }, { status: 400 });
  }
  return publicRedirect(req, `/admin/tenants/${tenantId}`, 303);
}
