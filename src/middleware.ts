import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Edge-safe auth gate. Validates the NextAuth JWT cookie (session strategy:
 * "jwt") and either lets the request through, redirects to /login, or
 * returns 401 JSON for API routes.
 *
 * Per-tenant authorization, role checks, and AuditEvent emission still
 * happen inside individual route handlers — this middleware only guards
 * the trust boundary.
 */
export async function middleware(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    // `secureCookie` lets NextAuth pick the right cookie name (auto-prefixed
    // with `__Secure-` in production) and the matching encryption salt.
    // Pass-8 audit caught the prior version misusing `salt` (an encryption
    // salt) as a cookie-name override; the value happened to match the
    // default but the parameter was semantically wrong.
    secureCookie: process.env.NODE_ENV === "production",
  });

  if (token?.userId) {
    return NextResponse.next();
  }

  const isApi = req.nextUrl.pathname.startsWith("/api/");
  if (isApi) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Run on every path EXCEPT:
  //   /login                — the login page itself
  //   /api/auth/*           — NextAuth's own routes (sign in/out, callbacks)
  //   /api/cron/*           — cron handler does its own bearer-token check
  //   /_next/* and assets   — Next.js internals and static files
  //   /favicon.ico, /robots.txt, /sitemap.xml — public surface
  //   anything with a file extension — public/ assets like *.svg, *.png
  matcher: [
    "/((?!login|api/auth|api/cron|api/health|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.[a-zA-Z0-9]+$).*)",
  ],
};
