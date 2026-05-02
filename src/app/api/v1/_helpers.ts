import { NextRequest, NextResponse } from "next/server";
import { verifyApiToken, tokenHasScope, type AuthenticatedToken } from "@/lib/api-token";

/**
 * Shared auth + scope check for all /api/v1/* routes. Returns the
 * authenticated token + helper, or a 401/403 response to short-circuit.
 *
 * Usage:
 *   const auth = await authenticate(req, "read:projects");
 *   if (auth instanceof NextResponse) return auth;
 *   // auth.tenantId scoped queries here
 */
export async function authenticate(
  req: NextRequest,
  scope: string,
): Promise<AuthenticatedToken | NextResponse> {
  const token = await verifyApiToken(req.headers.get("authorization"));
  if (!token) {
    return NextResponse.json({ error: "unauthorized", message: "Bearer token missing or invalid" }, { status: 401 });
  }
  if (!tokenHasScope(token.scopes, scope)) {
    return NextResponse.json({ error: "forbidden", message: `Token lacks scope "${scope}"` }, { status: 403 });
  }
  return token;
}

/**
 * Standard JSON envelope for v1 list endpoints — pagination metadata
 * + data array. Mirrors Stripe / Linear pattern.
 */
export function listEnvelope<T>(items: T[], opts?: { hasMore?: boolean; total?: number }): NextResponse {
  return NextResponse.json({
    data: items,
    has_more: opts?.hasMore ?? false,
    total: opts?.total,
  }, { headers: { "cache-control": "no-store" } });
}

export function objectEnvelope<T>(obj: T): NextResponse {
  return NextResponse.json({ data: obj }, { headers: { "cache-control": "no-store" } });
}
