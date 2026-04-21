import { NextResponse } from "next/server";
import { respondRfi } from "@/lib/record-actions";
import { requireTenant } from "@/lib/tenant";
import { publicRedirect } from "@/lib/redirect";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const tenant = await requireTenant();
  const form = await req.formData();
  const response = String(form.get("response") ?? form.get("note") ?? "");
  const result = await respondRfi(id, tenant.id, response);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return publicRedirect(req, req.headers.get("referer") ?? "/", 303);
}
