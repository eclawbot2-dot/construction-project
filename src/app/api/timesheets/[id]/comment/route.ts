import { NextResponse } from "next/server";
import { commentOnTimesheet } from "@/lib/timesheets";
import { requireTenant } from "@/lib/tenant";
import { publicRedirect } from "@/lib/redirect";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const tenant = await requireTenant();
  const form = await req.formData();
  const body = String(form.get("body") ?? "");
  const result = await commentOnTimesheet(id, tenant.id, body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return publicRedirect(req, `/timesheets/${id}`, 303);
}
