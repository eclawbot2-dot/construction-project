import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/permissions";
import { publicRedirect } from "@/lib/redirect";

export async function POST(req: Request, ctx: { params: Promise<{ tenantId: string }> }) {
  await requireSuperAdmin();
  const { tenantId } = await ctx.params;
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) return NextResponse.json({ error: "not found" }, { status: 404 });
  const res = publicRedirect(req, `/`, 303);
  res.cookies.set("cx.tenant", tenant.slug, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  return res;
}
