import { NextResponse } from "next/server";
import { commitImport } from "@/lib/historical-import";
import { requireTenant } from "@/lib/tenant";
import { requireManager } from "@/lib/permissions";
import { publicRedirect } from "@/lib/redirect";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const tenant = await requireTenant();
  await requireManager(tenant.id);
  const result = await commitImport(id, tenant.id);
  if (!result.ok) return NextResponse.json({ error: result.note }, { status: 400 });
  return publicRedirect(req, `/imports/${id}`, 303);
}
