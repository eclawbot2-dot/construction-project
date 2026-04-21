import { NextResponse } from "next/server";
import { rejectTimesheet } from "@/lib/timesheets";
import { requireTenant } from "@/lib/tenant";
import { publicRedirect } from "@/lib/redirect";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const tenant = await requireTenant();
  const form = await req.formData();
  const reason = String(form.get("reason") ?? "");
  const result = await rejectTimesheet(id, tenant.id, reason);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return publicRedirect(req, `/timesheets/${id}`, 303);
}
