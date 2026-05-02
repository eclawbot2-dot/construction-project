import { NextRequest, NextResponse } from "next/server";

/**
 * Pure logic underneath rejectIfCrossOrigin — testable without
 * NextRequest/NextResponse plumbing. Returns:
 *   - "allow"   : origin missing or matches host
 *   - "block"   : origin present and host mismatched
 *   - "bad"     : origin header malformed
 */
export type CsrfDecision = "allow" | "block" | "bad";

export function csrfDecide(origin: string | null, host: string | null): CsrfDecision {
  if (!origin) return "allow";
  if (!host) return "bad";
  try {
    return new URL(origin).host === host ? "allow" : "block";
  } catch {
    return "bad";
  }
}

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
  const decision = csrfDecide(req.headers.get("origin"), req.headers.get("host"));
  if (decision === "block") {
    return NextResponse.json({ error: "cross-origin POST blocked" }, { status: 403 });
  }
  if (decision === "bad") {
    return NextResponse.json({ error: "bad origin" }, { status: 400 });
  }
  return null;
}
