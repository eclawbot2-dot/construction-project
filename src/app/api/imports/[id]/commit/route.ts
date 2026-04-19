import { NextResponse } from "next/server";
import { commitImport } from "@/lib/historical-import";
import { requireTenant } from "@/lib/tenant";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const tenant = await requireTenant();
  const result = await commitImport(id, tenant.id);
  if (!result.ok) return NextResponse.json({ error: result.note }, { status: 400 });
  return NextResponse.redirect(new URL(`/imports/${id}`, req.url), { status: 303 });
}
