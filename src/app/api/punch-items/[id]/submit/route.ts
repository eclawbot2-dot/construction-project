import { NextResponse } from "next/server";
import { submitPunch } from "@/lib/record-actions";
import { requireTenant } from "@/lib/tenant";
import { publicRedirect } from "@/lib/redirect";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const tenant = await requireTenant();
  const form = await req.formData();
  const note = form.get("note") ? String(form.get("note")) : undefined;
  const result = await submitPunch(id, tenant.id, note);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return publicRedirect(req, req.headers.get("referer") ?? "/", 303);
}
