/**
 * Construction OS service worker — minimal offline-first cache for
 * the app shell + an outbox for unsynced daily-log POSTs. Field
 * crews on bad networks can keep capturing data; the SW retries
 * on connection.
 */

const CACHE_NAME = "bcon-shell-v1";
const SHELL_URLS = ["/", "/login", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((c) => c.addAll(SHELL_URLS).catch(() => null)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // Pass-through API + dynamic content; only cache navigations + static.
  if (req.method !== "GET") {
    event.respondWith(handleMutation(req));
    return;
  }
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match("/").then((r) => r ?? new Response("Offline", { status: 503 }))),
    );
    return;
  }
  if (req.url.includes("/_next/static/") || req.url.endsWith(".png") || req.url.endsWith(".webmanifest")) {
    event.respondWith(
      caches.match(req).then((cached) =>
        cached ?? fetch(req).then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, clone)).catch(() => null);
          return res;
        }),
      ),
    );
  }
});

/**
 * Mutation handler — try the network; on failure, queue in IndexedDB
 * for later retry via Background Sync API.
 */
async function handleMutation(req) {
  try {
    return await fetch(req);
  } catch {
    // Only enqueue mutation requests we know are idempotent or the
    // user can re-submit. Daily logs + photo uploads are the
    // important ones; tag them via the X-BCON-Outbox header on the
    // client side.
    if (req.headers.get("x-bcon-outbox") === "1") {
      const payload = await req.clone().arrayBuffer();
      await enqueueOutbox(req.url, req.method, Array.from(new Uint8Array(payload)));
      return new Response(JSON.stringify({ queued: true, offline: true }), {
        status: 202,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "offline" }), { status: 503, headers: { "content-type": "application/json" } });
  }
}

const DB_NAME = "bcon-outbox";
const STORE = "queue";

function openDb() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function enqueueOutbox(url, method, body) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).add({ url, method, body, queuedAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Background Sync — flushes the outbox when connectivity returns.
self.addEventListener("sync", (event) => {
  if (event.tag === "bcon-outbox-flush") {
    event.waitUntil(flushOutbox());
  }
});

async function flushOutbox() {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  const all = await new Promise((res, rej) => {
    const req = store.getAll();
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
  for (const item of all) {
    try {
      const res = await fetch(item.url, {
        method: item.method,
        body: new Uint8Array(item.body),
      });
      if (res.ok) store.delete(item.id);
    } catch {
      /* leave in queue for next sync */
    }
  }
}
