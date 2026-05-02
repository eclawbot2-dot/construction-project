import { redirect } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { StatTile } from "@/components/ui/stat-tile";
import { auth } from "@/lib/auth";
import { snapshot } from "@/lib/metrics";
import { formatDateTime } from "@/lib/utils";

/**
 * Observability page — surfaces in-process metrics for super-admins.
 * Sized for the 3-4 customer footprint: in-memory ring buffers, no
 * external metrics stack. State resets on process restart, which is
 * fine because incident response uses the structured log stream and
 * the AuditEvent / WebhookDelivery DB tables for forensics.
 */
export default async function ObservabilityPage({ searchParams }: { searchParams: Promise<{ window?: string }> }) {
  const session = await auth();
  if (!session?.superAdmin) {
    redirect("/settings");
  }
  const sp = await searchParams;
  const windowMinutes = Math.max(1, Math.min(1440, Number(sp.window ?? "60")));
  const data = snapshot(windowMinutes * 60 * 1000);

  const errorRate = (data.errorRate * 100).toFixed(2);
  const errorTone: "warn" | "default" | "good" = data.errorRate > 0.05 ? "warn" : data.errorRate > 0 ? "default" : "good";

  return (
    <AppLayout
      eyebrow="Platform · super admin"
      title="Observability"
      description="In-process request and error metrics. State resets on deploy. For permanent forensics use the audit log + structured log stream."
    >
      <div className="grid gap-6">
        <section className="grid gap-4 md:grid-cols-4">
          <StatTile label={`Requests (last ${windowMinutes}m)`} value={data.totalRequests} sub={data.totalRequests === 0 ? "no traffic captured" : undefined} />
          <StatTile label="Error rate" value={`${errorRate}%`} tone={errorTone} sub={`${data.errorCount} errors`} />
          <StatTile label="p50 / p95 latency" value={`${data.p50Ms} / ${data.p95Ms}ms`} tone={data.p95Ms > 1000 ? "warn" : "good"} />
          <StatTile label="Slow requests" value={data.slowCount} sub="≥1s response" tone={data.slowCount > 0 ? "warn" : "good"} />
        </section>

        <section className="card p-5">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-[0.16em] text-slate-400">Window (minutes)</span>
              <select name="window" defaultValue={String(windowMinutes)} className="form-select">
                <option value="15">Last 15 minutes</option>
                <option value="60">Last hour</option>
                <option value="240">Last 4 hours</option>
                <option value="720">Last 12 hours</option>
                <option value="1440">Last 24 hours</option>
              </select>
            </label>
            <button type="submit" className="btn-primary">Refresh</button>
            <span className="text-xs text-slate-500">Snapshot at {formatDateTime(new Date(data.generatedAt))}</span>
          </form>
        </section>

        <section className="card p-0 overflow-hidden">
          <div className="px-5 py-3 text-xs uppercase tracking-[0.2em] text-cyan-300">Per-route latency</div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-sm">
              <thead className="bg-white/5">
                <tr>
                  <th className="table-header">Route</th>
                  <th className="table-header text-right">Count</th>
                  <th className="table-header text-right">Errors</th>
                  <th className="table-header text-right">Avg</th>
                  <th className="table-header text-right">p50</th>
                  <th className="table-header text-right">p95</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-slate-950/40">
                {data.perRoute.slice(0, 50).map((r) => (
                  <tr key={r.route} className={r.errorCount > 0 ? "bg-rose-500/5" : ""}>
                    <td className="table-cell font-mono text-xs">{r.route}</td>
                    <td className="table-cell text-right tabular-nums">{r.count}</td>
                    <td className="table-cell text-right tabular-nums">{r.errorCount > 0 ? <span className="text-rose-300">{r.errorCount}</span> : 0}</td>
                    <td className="table-cell text-right tabular-nums">{r.avgMs}ms</td>
                    <td className="table-cell text-right tabular-nums">{r.p50Ms}ms</td>
                    <td className={`table-cell text-right tabular-nums ${r.p95Ms > 1000 ? "text-amber-300" : ""}`}>{r.p95Ms}ms</td>
                  </tr>
                ))}
                {data.perRoute.length === 0 ? (
                  <tr><td colSpan={6} className="table-cell text-center text-slate-500 py-8">
                    No requests recorded yet — middleware captures auth-terminated requests; route handlers must call <code className="text-xs text-cyan-300">withMetrics()</code> for full coverage.
                  </td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card p-0 overflow-hidden">
          <div className="px-5 py-3 text-xs uppercase tracking-[0.2em] text-cyan-300">Recent errors</div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-sm">
              <thead className="bg-white/5">
                <tr>
                  <th className="table-header">When</th>
                  <th className="table-header">Module</th>
                  <th className="table-header">Path</th>
                  <th className="table-header">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-slate-950/40">
                {data.recentErrors.map((e, i) => (
                  <tr key={`${e.t}-${i}`}>
                    <td className="table-cell text-xs text-slate-400">{formatDateTime(new Date(e.t))}</td>
                    <td className="table-cell font-mono text-xs">{e.module}</td>
                    <td className="table-cell font-mono text-xs text-slate-400">{e.path ?? "—"}</td>
                    <td className="table-cell text-rose-200">{e.message}</td>
                  </tr>
                ))}
                {data.recentErrors.length === 0 ? (
                  <tr><td colSpan={4} className="table-cell text-center text-slate-500 py-6">No errors captured in this window — clean.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card p-0 overflow-hidden">
          <div className="px-5 py-3 text-xs uppercase tracking-[0.2em] text-cyan-300">Cron runs</div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-sm">
              <thead className="bg-white/5">
                <tr>
                  <th className="table-header">Job</th>
                  <th className="table-header">Last run</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Duration</th>
                  <th className="table-header">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-slate-950/40">
                {data.cronRuns.map((r) => (
                  <tr key={r.name}>
                    <td className="table-cell font-mono text-xs">{r.name}</td>
                    <td className="table-cell text-xs text-slate-400">{formatDateTime(new Date(r.startedAt))}</td>
                    <td className="table-cell">
                      {r.ok ? (
                        <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-200">ok</span>
                      ) : (
                        <span className="rounded-full border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-200">failed</span>
                      )}
                    </td>
                    <td className="table-cell text-right tabular-nums text-xs">{r.finishedAt - r.startedAt}ms</td>
                    <td className="table-cell text-xs text-slate-400">{r.message ?? "—"}</td>
                  </tr>
                ))}
                {data.cronRuns.length === 0 ? (
                  <tr><td colSpan={5} className="table-cell text-center text-slate-500 py-6">No cron runs captured since restart.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card p-5">
          <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Notes</div>
          <ul className="mt-2 list-disc pl-5 text-xs text-slate-400 space-y-1">
            <li>State resets on process restart. For long-term forensics use the audit log and structured log stream.</li>
            <li>Sized for 3–4 customer scale. In-memory ring buffers: 500 requests, 100 errors. Per-route reservoir of 50 samples for percentiles.</li>
            <li>Set <code className="text-cyan-300">SENTRY_DSN</code> to also forward errors to Sentry. <code className="text-cyan-300">log.ts</code> auto-forwards on captureException.</li>
          </ul>
        </section>
      </div>
    </AppLayout>
  );
}
