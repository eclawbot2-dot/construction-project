import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const form = await req.formData();
  const slug = String(form.get("slug") ?? "").trim();
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) return NextResponse.json({ error: "not found" }, { status: 404 });

  const redirectTo = String(form.get("redirect") ?? "/") || "/";
  const res = NextResponse.redirect(new URL(redirectTo, req.url), { status: 303 });
  res.cookies.set("cx.tenant", slug, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  return res;
}
