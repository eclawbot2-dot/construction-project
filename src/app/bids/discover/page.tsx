import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { discoverPortalsForGeo } from "@/lib/rfp-geo";

const AUTH_DESC: Record<string, string> = {
  NONE: "Public — no login",
  FREE_ACCOUNT: "Free account",
  PAID_ACCOUNT: "Paid subscription",
  API_KEY: "API key",
};

export default async function DiscoverPortalsPage({ searchParams }: { searchParams: Promise<{ state?: string; city?: string }> }) {
  const tenant = await requireTenant();
  const sp = await searchParams;
  const state = (sp.state ?? "SC").toUpperCase();
  const city = sp.city ?? "";
  const portals = discoverPortalsForGeo({ state, city });
  const already = await prisma.rfpSource.findMany({ where: { tenantId: tenant.id }, select: { url: true } });
  const alreadyUrls = new Set(already.map((a) => a.url));

  const grouped = portals.reduce<Record<string, typeof portals>>((acc, p) => {
    (acc[p.category] ??= []).push(p);
    return acc;
  }, {});

  const labels: Record<string, string> = { federal: "Federal & DoD", state: "State agencies + DOT", local: "County / city / utility", aggregator: "Aggregators + bid boards", industry: "Industry-specific" };

  return (
    <AppLayout eyebrow="BD · Portal discovery" title={`Watchable solicitation portals in ${state}${city ? ` · ${city}` : ""}`} description="Government + private portals known to publish construction RFPs in this geography. One-click to watch.">
      <div className="grid gap-6">
        <section className="card p-5">
          <form className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <label className="block">
              <span className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-400">State</span>
              <input name="state" defaultValue={state} placeholder="SC" className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-400">City (optional)</span>
              <input name="city" defaultValue={city} placeholder="Charleston" className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500" />
            </label>
            <button type="submit" className="btn-primary">Find portals</button>
          </form>
        </section>
        {Object.keys(grouped).map((cat) => (
          <section key={cat} className="card p-5">
            <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">{labels[cat] ?? cat}</div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {grouped[cat].map((p) => {
                const watching = alreadyUrls.has(p.url);
                return (
                  <div key={p.url} className="panel p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-medium text-white">{p.name}</div>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-slate-300">{AUTH_DESC[p.authType]}</span>
                    </div>
                    <div className="mt-2 text-xs text-slate-400 break-all"><a href={p.url} target="_blank" rel="noopener" className="hover:text-cyan-300">{p.url}</a></div>
                    {p.description ? <p className="mt-2 text-sm text-slate-300">{p.description}</p> : null}
                    <div className="mt-2 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.18em] text-slate-500">
                      {p.geoState ? <span>{p.geoState}</span> : null}
                      {p.geoCity ? <span>· {p.geoCity}</span> : null}
                      {p.naicsFocus ? <span>· NAICS {p.naicsFocus}</span> : null}
                    </div>
                    <div className="mt-4 flex gap-2">
                      {watching ? (
                        <span className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200">Watching</span>
                      ) : (
                        <form action="/api/rfp/sources/create" method="post" className="flex flex-wrap gap-2">
                          <input type="hidden" name="label" value={p.name} />
                          <input type="hidden" name="url" value={p.url} />
                          <input type="hidden" name="agencyHint" value={p.name} />
                          <input type="hidden" name="naicsFilter" value={p.naicsFocus ?? ""} />
                          <input type="hidden" name="geoState" value={p.geoState ?? ""} />
                          <input type="hidden" name="geoCity" value={p.geoCity ?? ""} />
                          <input type="hidden" name="geoScope" value={p.geoScope} />
                          <input type="hidden" name="authType" value={p.authType} />
                          <input type="hidden" name="cadence" value={p.authType === "NONE" ? "DAILY" : "WEEKLY"} />
                          <button type="submit" className="btn-primary text-xs">Watch this source</button>
                        </form>
                      )}
                      {p.signupUrl ? <a href={p.signupUrl} target="_blank" rel="noopener" className="btn-outline text-xs">Sign up</a> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
        <div className="card p-5 text-xs text-slate-500">
          Need authentication? Add a source from <Link href="/bids/sources" className="text-cyan-300 hover:underline">/bids/sources</Link> and include credentials — passwords and API keys are stored AES-256-GCM encrypted with a per-tenant key.
        </div>
      </div>
    </AppLayout>
  );
}
