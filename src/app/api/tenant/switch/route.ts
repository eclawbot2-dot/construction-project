import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const form = await req.formData();
  const slug = String(form.get("slug") ?? "").trim();
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) return NextResponse.json({ error: "not found" }, { status: 404 });

  const redirectTo = String(form.get("redirect") ?? "/") || "/";

  // Running behind Cloudflare tunnel — req.url reports the upstream origin
  // (e.g. http://localhost:3101), so we rebuild the redirect against the
  // public host using forwarded headers.
  const forwardedHost = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const forwardedProto = req.headers.get("x-forwarded-proto") ?? "https";
  const base = forwardedHost ? `${forwardedProto}://${forwardedHost}` : new URL(req.url).origin;
  const location = new URL(redirectTo, base).toString();

  const res = NextResponse.redirect(location, { status: 303 });
  res.cookies.set("cx.tenant", slug, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  return res;
}
