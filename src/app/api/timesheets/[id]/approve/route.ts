import { NextResponse } from "next/server";
import { approveTimesheet } from "@/lib/timesheets";
import { requireTenant } from "@/lib/tenant";
import { publicRedirect } from "@/lib/redirect";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const tenant = await requireTenant();
  const form = await req.formData();
  const note = form.get("note") ? String(form.get("note")) : undefined;
  const result = await approveTimesheet(id, tenant.id, note);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 403 });
  return publicRedirect(req, `/timesheets/${id}`, 303);
}
