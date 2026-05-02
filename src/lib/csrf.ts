import { NextRequest, NextResponse } from "next/server";

/**
 * Origin-header CSRF defense for state-mutating routes.
 *
 * NextAuth's session cookie defaults to SameSite=Lax which blocks
 * cross-site form POSTs in modern browsers, but a misconfigured
 * cookie or proxy could weaken that protection. Explicit Origin
 * checking on each mutating route makes the defense independent of
 * cookie defaults — and trivial enough to apply everywhere.
 *
 * Returns a 403 NextResponse to short-circuit the route, or null to
 * let the route continue. Origin missing (some user-agents do this
 * on same-origin requests) is allowed; only present-but-mismatched
 * is blocked.
 */
export function rejectIfCrossOrigin(req: NextRequest): NextResponse | null {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origin) return null;
  try {
    if (new URL(origin).host !== host) {
      return NextResponse.json({ error: "cross-origin POST blocked" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "bad origin" }, { status: 400 });
  }
  return null;
}
