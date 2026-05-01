/**
 * Object storage adapter — pluggable transport.
 *
 * Background (audit Pass 7 §3.1, §6 closing): the platform has no object
 * storage layer. File uploads (imports, photos, document attachments) all
 * end up either parsed-and-discarded or held in the row that triggered
 * them. There's no way to preserve the original artifact (a key compliance
 * requirement under req §6.3 and the public-sector workflows in §7.21).
 *
 * This module defines a thin Storage interface with a working LocalDisk
 * default. Production picks one of the cloud adapters below by setting
 * the STORAGE_TRANSPORT env var; the API surface is the same.
 *
 *   STORAGE_TRANSPORT=local       (default — writes to ./uploads/)
 *   STORAGE_TRANSPORT=memory      (test-only; never persists)
 *   STORAGE_TRANSPORT=s3          (NOT IMPLEMENTED — needs `npm install
 *                                  @aws-sdk/client-s3` and an adapter)
 *   STORAGE_TRANSPORT=r2          (NOT IMPLEMENTED — Cloudflare R2 via S3)
 *
 * Design choices:
 *   - All methods are async to keep the surface stable across cloud adapters.
 *   - `put` returns the storage key and a URL the browser can hit. For the
 *     local adapter, URL is a relative path under /uploads/<key> — Next.js
 *     serves it from `public/uploads/` once we publish it (this PR keeps
 *     them outside `public/` for safety; serving requires a follow-up).
 *   - Keys are tenant-prefixed by convention (callers prepend tenant id)
 *     so a single bucket can host many tenants without collisions.
 *   - `signedUrl` is a no-op for the local adapter (returns the same URL)
 *     and a real time-bound signed URL for cloud adapters.
 */

import { mkdir, writeFile, readFile, unlink, stat } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";

export type PutResult = { key: string; url: string; size: number; contentType?: string };

export interface Storage {
  name: string;
  /** Persist `body` under a deterministic key. Caller may pass a key or
   *  let the adapter generate one. Returns the canonical key + browser URL. */
  put(args: { key?: string; tenantId: string; body: Buffer | string; contentType?: string; filename?: string }): Promise<PutResult>;
  /** Read raw bytes for a key. Throws if missing. */
  get(key: string): Promise<Buffer>;
  /** Remove an object. Idempotent — does not throw on missing. */
  delete(key: string): Promise<void>;
  /** Browser-reachable URL for a key. May return a presigned URL with TTL. */
  signedUrl(key: string, ttlSeconds?: number): Promise<string>;
  /** Best-effort size lookup; returns null if unknown / missing. */
  size(key: string): Promise<number | null>;
}

class LocalDiskStorage implements Storage {
  name = "local";
  private root: string;
  private urlPrefix: string;

  constructor(opts?: { root?: string; urlPrefix?: string }) {
    this.root = opts?.root ?? path.join(process.cwd(), "uploads");
    this.urlPrefix = opts?.urlPrefix ?? "/uploads";
  }

  private resolveKey(tenantId: string, providedKey?: string, filename?: string): string {
    if (providedKey) return providedKey;
    const id = randomBytes(8).toString("hex");
    const safe = (filename ?? "blob").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
    return `${tenantId}/${id}-${safe}`;
  }

  async put(args: { key?: string; tenantId: string; body: Buffer | string; contentType?: string; filename?: string }): Promise<PutResult> {
    const key = this.resolveKey(args.tenantId, args.key, args.filename);
    const fullPath = path.join(this.root, key);
    await mkdir(path.dirname(fullPath), { recursive: true });
    const buf = typeof args.body === "string" ? Buffer.from(args.body) : args.body;
    await writeFile(fullPath, buf);
    return {
      key,
      url: `${this.urlPrefix}/${key}`,
      size: buf.byteLength,
      contentType: args.contentType,
    };
  }

  async get(key: string): Promise<Buffer> {
    const fullPath = path.join(this.root, key);
    return readFile(fullPath);
  }

  async delete(key: string): Promise<void> {
    const fullPath = path.join(this.root, key);
    await unlink(fullPath).catch(() => {
      /* missing-on-delete is not an error */
    });
  }

  async signedUrl(key: string): Promise<string> {
    return `${this.urlPrefix}/${key}`;
  }

  async size(key: string): Promise<number | null> {
    try {
      const s = await stat(path.join(this.root, key));
      return s.size;
    } catch {
      return null;
    }
  }
}

class MemoryStorage implements Storage {
  name = "memory";
  private blobs = new Map<string, Buffer>();

  async put(args: { key?: string; tenantId: string; body: Buffer | string; contentType?: string; filename?: string }): Promise<PutResult> {
    const key = args.key ?? `${args.tenantId}/${randomBytes(6).toString("hex")}-${args.filename ?? "blob"}`;
    const buf = typeof args.body === "string" ? Buffer.from(args.body) : args.body;
    this.blobs.set(key, buf);
    return { key, url: `mem://${key}`, size: buf.byteLength, contentType: args.contentType };
  }

  async get(key: string): Promise<Buffer> {
    const b = this.blobs.get(key);
    if (!b) throw new Error(`memory storage: no object at ${key}`);
    return b;
  }

  async delete(key: string): Promise<void> {
    this.blobs.delete(key);
  }

  async signedUrl(key: string): Promise<string> {
    return `mem://${key}`;
  }

  async size(key: string): Promise<number | null> {
    return this.blobs.get(key)?.byteLength ?? null;
  }
}

let active: Storage = bootstrap();

function bootstrap(): Storage {
  const choice = (process.env.STORAGE_TRANSPORT ?? "local").toLowerCase();
  if (choice === "memory") return new MemoryStorage();
  if (choice === "s3" || choice === "r2") {
    console.warn(
      `[storage] STORAGE_TRANSPORT=${choice} is not yet implemented; ` +
      "falling back to local disk. Install the adapter package and add a class here.",
    );
  }
  return new LocalDiskStorage();
}

export function getStorage(): Storage {
  return active;
}

export function setStorage(s: Storage): void {
  active = s;
}
