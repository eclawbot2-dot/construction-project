/**
 * App-wide route-loading skeleton. Next.js renders this while a server
 * component is awaiting its data. Keeps navigation feeling snappy
 * instead of leaving the previous page frozen during a slow query.
 *
 * Per-route loading.tsx files override this — use them for finer-grained
 * skeletons that match the destination layout.
 */
export default function Loading() {
  return (
    <div className="grid gap-6 p-6 animate-pulse" aria-busy="true" aria-live="polite">
      <div className="h-8 w-1/3 rounded bg-white/5" />
      <div className="grid gap-4 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-white/[0.04]" />
        ))}
      </div>
      <div className="h-72 rounded-2xl bg-white/[0.04]" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
