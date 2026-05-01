/**
 * Tiny in-memory rate limiter — sliding window keyed by an arbitrary string
 * (typically `${endpoint}:${ip}` or `${endpoint}:${email}`).
 *
 * Pass-8 audit flagged the credentials login endpoint as having no
 * brute-force protection. NextAuth v5 has no built-in throttle, so this
 * module fills the gap for the single-instance Windows deploy. For a
 * multi-worker / multi-host production we'd swap in a Redis-backed limiter
 * (e.g. @upstash/ratelimit) behind the same `consume()` API.
 *
 * Implementation notes:
 *   - Storage is a `Map` in process memory. Acceptable for the current
 *     single-Node deploy. NOT shared across workers.
 *   - The window is sliding-token-bucket-lite: each entry stores the
 *     timestamps of recent attempts inside the window; older entries are
 *     pruned on every call. O(N) per consume where N is the per-key cap
 *     (5 by default), so cheap.
 *   - The bucket is opportunistically swept (lazy GC) — keys older than
 *     the window get cleared on the next call that touches them. A
 *     stale-key sweep would only matter on enormous IP fan-out, which
 *     this deploy won't see.
 */

type Bucket = { hits: number[] };

const store = new Map<string, Bucket>();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

/**
 * Consume one token from the bucket for `key`. Returns `{ allowed: false }`
 * once the bucket is exhausted within the window. The caller should not
 * proceed with the rate-limited action; the credentials login uses this
 * to short-circuit `authorize()` and return null without running bcrypt.
 */
export function consumeRateLimit(key: string, opts: { limit: number; windowMs: number }): RateLimitResult {
  const now = Date.now();
  const cutoff = now - opts.windowMs;

  const bucket = store.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => t > cutoff);

  if (bucket.hits.length >= opts.limit) {
    const oldest = bucket.hits[0] ?? now;
    return { allowed: false, remaining: 0, resetAt: oldest + opts.windowMs };
  }

  bucket.hits.push(now);
  store.set(key, bucket);
  return { allowed: true, remaining: opts.limit - bucket.hits.length, resetAt: now + opts.windowMs };
}

/**
 * Reset the bucket for a key — call after a successful login so the
 * counter doesn't accidentally lock out a legitimate user who fat-fingered
 * a password three times before getting it right.
 */
export function resetRateLimit(key: string): void {
  store.delete(key);
}

/**
 * Test-only: clear all buckets. Not exported for production use; if you
 * find yourself reaching for this, the right answer is probably a real
 * limiter.
 */
export function _resetAllRateLimits(): void {
  store.clear();
}
