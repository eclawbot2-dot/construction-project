/**
 * Server-Sent Events broker — in-process pub/sub for real-time UI
 * updates. Tenants subscribe via /api/sse?topic=… and the server
 * pushes JSON events as they fire. Falls back gracefully when the
 * client disconnects.
 *
 * In-process means horizontal scale-out needs Redis pub/sub or a
 * managed broker; this is sufficient for the single-host deployment
 * and provides the API shape so the swap is mechanical.
 */

type Listener = (payload: unknown) => void;

const channels = new Map<string, Set<Listener>>();

function key(tenantId: string, topic: string): string {
  return `${tenantId}::${topic}`;
}

export function publish(tenantId: string, topic: string, payload: unknown): void {
  const k = key(tenantId, topic);
  const listeners = channels.get(k);
  if (!listeners) return;
  for (const listener of listeners) {
    try { listener(payload); } catch { /* listener error must not break others */ }
  }
}

export function subscribe(tenantId: string, topic: string, listener: Listener): () => void {
  const k = key(tenantId, topic);
  let set = channels.get(k);
  if (!set) {
    set = new Set();
    channels.set(k, set);
  }
  set.add(listener);
  return () => {
    set!.delete(listener);
    if (set!.size === 0) channels.delete(k);
  };
}

/** Build a SSE-formatted ReadableStream that pushes events as they
 *  fire. Caller wraps in a Response with content-type text/event-stream. */
export function buildSseStream(tenantId: string, topic: string): ReadableStream {
  const encoder = new TextEncoder();
  let unsub: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`event: ready\ndata: {"topic":"${topic}"}\n\n`));
      unsub = subscribe(tenantId, topic, (payload) => {
        try {
          const data = JSON.stringify(payload);
          controller.enqueue(encoder.encode(`event: message\ndata: ${data}\n\n`));
        } catch { /* serialization failure dropped */ }
      });
      // Heartbeat every 25s — keeps proxies from killing idle connection.
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch { /* downstream closed */ }
      }, 25_000);
    },
    cancel() {
      unsub?.();
      if (heartbeat) clearInterval(heartbeat);
    },
  });
}
