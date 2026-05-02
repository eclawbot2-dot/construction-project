import { AppLayout } from "@/components/layout/app-layout";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { formatDateTime } from "@/lib/utils";

export default async function ApiTokensPage({ searchParams }: { searchParams: Promise<{ issued?: string }> }) {
  const tenant = await requireTenant();
  const sp = await searchParams;
  const tokens = await prisma.apiToken.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: "desc" },
  });
  const webhooks = await prisma.webhookEndpoint.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <AppLayout eyebrow="Settings · API" title="API tokens & webhooks" description="Bearer tokens for the public REST API at /api/v1/* and outbound webhooks for domain events.">
      <div className="grid gap-6">
        {sp.issued ? (
          <div className="card p-5 border-emerald-500/40 bg-emerald-500/5">
            <div className="text-xs uppercase tracking-[0.2em] text-emerald-300">New token (shown once)</div>
            <div className="mt-3 font-mono text-sm break-all rounded bg-slate-950 p-3 text-emerald-200">{sp.issued}</div>
            <p className="mt-2 text-xs text-rose-300">Copy this now — the secret is never shown again. If lost, revoke and reissue.</p>
          </div>
        ) : null}

        <section className="card p-5">
          <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Issue API token</div>
          <form action="/api/tenant/api-tokens/create" method="post" className="mt-3 grid gap-3 md:grid-cols-[2fr_2fr_auto]">
            <input name="name" required placeholder="Token name (e.g. CI integration)" className="form-input" />
            <input name="scopes" defaultValue="read:projects read:listings read:rfis" placeholder="Scopes (space-separated)" className="form-input font-mono text-xs" />
            <button className="btn-primary">Issue</button>
          </form>
          <p className="mt-2 text-xs text-slate-500">Common scopes: <code>read:projects</code>, <code>read:listings</code>, <code>read:rfis</code>, <code>write:rfis</code>, or <code>*</code> for all.</p>
        </section>

        <section className="card p-0 overflow-hidden">
          <div className="px-5 py-3 text-xs uppercase tracking-[0.2em] text-slate-400">Active tokens</div>
          <table className="min-w-full divide-y divide-white/10 text-sm">
            <thead className="bg-white/5">
              <tr>
                <th className="table-header">Name</th>
                <th className="table-header">Prefix</th>
                <th className="table-header">Scopes</th>
                <th className="table-header">Created</th>
                <th className="table-header">Last used</th>
                <th className="table-header" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {tokens.map((t) => {
                const scopes = (() => { try { return JSON.parse(t.scopesJson) as string[]; } catch { return []; } })();
                return (
                  <tr key={t.id} className={t.revokedAt ? "opacity-50" : ""}>
                    <td className="table-cell">{t.name}</td>
                    <td className="table-cell font-mono text-xs">{t.prefix}</td>
                    <td className="table-cell text-xs">{scopes.join(", ")}</td>
                    <td className="table-cell text-xs">{formatDateTime(t.createdAt)}</td>
                    <td className="table-cell text-xs">{t.lastUsedAt ? formatDateTime(t.lastUsedAt) : "—"}</td>
                    <td className="table-cell">
                      {!t.revokedAt ? (
                        <form action={`/api/tenant/api-tokens/${t.id}/revoke`} method="post">
                          <button className="btn-outline text-xs text-rose-300">Revoke</button>
                        </form>
                      ) : <span className="text-xs text-rose-400">revoked</span>}
                    </td>
                  </tr>
                );
              })}
              {tokens.length === 0 ? <tr><td colSpan={6} className="table-cell text-center text-slate-500 py-4">No tokens issued yet.</td></tr> : null}
            </tbody>
          </table>
        </section>

        <section className="card p-5">
          <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Webhook endpoints</div>
          <p className="mt-1 text-xs text-slate-400">Receive HMAC-signed POSTs when domain events fire (rfi.created, payapp.approved, listing.scored).</p>
          <form action="/api/tenant/webhooks/create" method="post" className="mt-3 grid gap-3 md:grid-cols-[2fr_2fr_auto]">
            <input name="url" required placeholder="https://example.com/hook" className="form-input" />
            <input name="events" defaultValue="*" placeholder="Events (space-separated, * for all)" className="form-input font-mono text-xs" />
            <button className="btn-primary">Add endpoint</button>
          </form>
        </section>

        <section className="card p-0 overflow-hidden">
          <table className="min-w-full divide-y divide-white/10 text-sm">
            <thead className="bg-white/5">
              <tr>
                <th className="table-header">URL</th>
                <th className="table-header">Events</th>
                <th className="table-header">Last delivery</th>
                <th className="table-header">Failures</th>
                <th className="table-header" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {webhooks.map((w) => {
                const events = (() => { try { return JSON.parse(w.eventsJson) as string[]; } catch { return []; } })();
                return (
                  <tr key={w.id} className={w.active ? "" : "opacity-50"}>
                    <td className="table-cell font-mono text-xs truncate max-w-[280px]">{w.url}</td>
                    <td className="table-cell text-xs">{events.join(", ")}</td>
                    <td className="table-cell text-xs">{w.lastDeliveryAt ? formatDateTime(w.lastDeliveryAt) : "—"}</td>
                    <td className={`table-cell text-xs ${w.failureCount > 0 ? "text-rose-300" : ""}`}>{w.failureCount}</td>
                    <td className="table-cell">
                      <form action={`/api/tenant/webhooks/${w.id}/toggle`} method="post">
                        <button className="btn-outline text-xs">{w.active ? "Disable" : "Enable"}</button>
                      </form>
                    </td>
                  </tr>
                );
              })}
              {webhooks.length === 0 ? <tr><td colSpan={5} className="table-cell text-center text-slate-500 py-4">No webhook endpoints registered.</td></tr> : null}
            </tbody>
          </table>
        </section>

        <section className="card p-5 text-xs text-slate-400">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">API documentation</div>
          <p className="mt-2">Full spec at <a href="/api/v1/openapi" className="text-cyan-300 hover:underline" target="_blank" rel="noopener">/api/v1/openapi</a> (no auth needed). Authenticate with <code className="font-mono">Authorization: Bearer bcon_…</code>. Rate limits: 60 req/min per token.</p>
        </section>
      </div>
    </AppLayout>
  );
}
