import { NextResponse } from "next/server";

/**
 * Standard Cache-Control helpers for API responses. Default for
 * mutating APIs is no-store; read-only APIs can opt into short
 * caches with stale-while-revalidate. Always include tenantId in the
 * Vary header for tenant-scoped caches so a CDN can't cross-pollinate.
 */

export function noStore<T>(json: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(json, {
    ...(init ?? {}),
    headers: {
      "cache-control": "no-store, no-cache, must-revalidate",
      ...((init?.headers as Record<string, string>) ?? {}),
    },
  });
}

export function shortCache<T>(json: T, seconds = 30, swrSeconds = 60): NextResponse {
  return NextResponse.json(json, {
    headers: {
      "cache-control": `private, max-age=${seconds}, stale-while-revalidate=${swrSeconds}`,
      vary: "cookie",
    },
  });
}
