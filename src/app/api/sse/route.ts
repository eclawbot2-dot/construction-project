import { NextRequest } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { buildSseStream } from "@/lib/sse";

/**
 * GET /api/sse?topic=… — SSE stream of real-time events for the
 * authenticated tenant. Topic is namespaced; valid examples:
 *   listings  — new RFP listings ingested
 *   rfis      — RFI lifecycle events
 *   alerts    — new alert events
 *   payapps   — pay-app status changes
 */
export async function GET(req: NextRequest) {
  const tenant = await requireTenant();
  const url = new URL(req.url);
  const topic = (url.searchParams.get("topic") ?? "all").trim();
  const stream = buildSseStream(tenant.id, topic);
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
