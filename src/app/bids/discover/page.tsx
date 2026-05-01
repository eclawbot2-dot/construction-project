import { AppLayout } from "@/components/layout/app-layout";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { AgencyKind, AgencyTier } from "@prisma/client";
import Link from "next/link";

const AUTH_DESC: Record<string, string> = {
  NONE: "Public — no login",
  LOGIN: "Account required",
  FREE_ACCOUNT: "Free account",
  PAID_ACCOUNT: "Paid subscription",
  API_KEY: "API key",
};

const ALL_KINDS: AgencyKind[] = ["FEDERAL", "STATE", "COUNTY", "MUNICIPAL", "TRIBAL", "AUTHORITY", "AGGREGATOR", "PRIVATE"];

const KIND_LABEL: Record<AgencyKind, string> = {
  FEDERAL: "Federal",
  STATE: "State",
  COUNTY: "County",
  MUNICIPAL: "Municipal",
  TRIBAL: "Tribal",
  AUTHORITY: "Authority",
  AGGREGATOR: "Aggregator",
  PRIVATE: "Private",
};

const TIER_LABEL: Record<AgencyTier, string> = {
  CIVILIAN: "Civilian",
  DOD: "DoD",
  VA: "VA",
  USACE: "USACE",
  GSA: "GSA",
  HOMELAND: "DHS",
  ENERGY: "DOE",
  TRANSPORTATION: "Transportation",
  HEALTH: "Health",
  EDUCATION: "Education",
  INDEPENDENT: "Independent",
  OTHER: "Other",
};

export default async function DiscoverPortalsPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; city?: string; kind?: string; tier?: string; q?: string }>;
}) {
  const tenant = await requireTenant();
  const sp = await searchParams;
  const state = sp.state?.toUpperCase() ?? "";
  const city = sp.city ?? "";
  const kindFilter = ALL_KINDS.includes(sp.kind as AgencyKind) ? (sp.kind as AgencyKind) : null;
  const tierFilter = sp.tier && Object.keys(TIER_LABEL).includes(sp.tier) ? (sp.tier as AgencyTier) : null;
  const query = sp.q?.trim().toLowerCase() ?? "";

  const where: Record<string, unknown> = { active: true };
  if (kindFilter) where.agencyKind = kindFilter;
  if (tierFilter) where.agencyTier = tierFilter;
  if (state) where.OR = [
    { geoState: state },
    { geoScope: { in: ["FEDERAL", "NATIONAL", "REGIONAL"] } },
  ];

  const portals = await prisma.solicitationPortalCatalog.findMany({
    where,
    orderBy: [{ agencyKind: "asc" }, { agencyTier: "asc" }, { name: "asc" }],
  });

  const filteredPortals = query
    ? portals.filter((p) => `${p.name} ${p.agencyName ?? ""} ${p.description ?? ""}`.toLowerCase().includes(query))
    : portals;

  const cityFiltered = city
    ? filteredPortals.filter((p) => !p.geoCity || p.geoCity.toLowerCase() === city.toLowerCase())
    : filteredPortals;

  const already = await prisma.rfpSource.findMany({
    where: { tenantId: tenant.id },
    select: { url: true, catalogId: true },
  });
  const alreadyUrls = new Set(already.map((a) => a.url));
  const alreadyCatalogIds = new Set(already.map((a) => a.catalogId).filter((id): id is string => !!id));

  const grouped = cityFiltered.reduce<Partial<Record<AgencyKind, typeof cityFiltered>>>((acc, p) => {
    (acc[p.agencyKind] ??= []).push(p);
    return acc;
  }, {});

  const totalKindCounts = ALL_KINDS.map((k) => ({
    kind: k,
    count: portals.filter((p) => p.agencyKind === k).length,
  })).filter((x) => x.count > 0);

  return (
    <AppLayout
      eyebrow="BD · Portal discovery"
      title="Watch a solicitation portal"
      description={`${portals.length} portals in catalog (federal, state, county, municipal, authority, aggregator). Filter by tier or geo, then 1-click subscribe.`}
    >
      <div className="grid gap-6">
        <section className="card p-5">
          <form className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] md:items-end">
            <label className="block">
              <span className="mb-1 block text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--faint)" }}>Search</span>
              <input name="q" defaultValue={query} placeholder="GSA, USACE, NAVFAC, county..." className="form-input" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--faint)" }}>Kind</span>
              <select name="kind" defaultValue={kindFilter ?? ""} className="form-select">
                <option value="">— any —</option>
                {ALL_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--faint)" }}>Tier</span>
              <select name="tier" defaultValue={tierFilter ?? ""} className="form-select">
                <option value="">— any —</option>
                {Object.entries(TIER_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--faint)" }}>State</span>
              <input name="state" defaultValue={state} placeholder="SC" className="form-input" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--faint)" }}>City</span>
              <input name="city" defaultValue={city} className="form-input" />
            </label>
            <button type="submit" className="btn-primary">Filter</button>
          </form>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {totalKindCounts.map((t) => (
              <Link
                key={t.kind}
                href={`/bids/discover?kind=${t.kind}`}
                className="rounded-full border px-2 py-1"
                style={{ borderColor: "var(--border)", color: kindFilter === t.kind ? "var(--accent, #67e8f9)" : "var(--faint)" }}
              >
                {KIND_LABEL[t.kind]} · {t.count}
              </Link>
            ))}
          </div>
        </section>

        {cityFiltered.length === 0 ? (
          <section className="card p-8 text-center" style={{ color: "var(--faint)" }}>
            No portals match these filters.
          </section>
        ) : null}

        {ALL_KINDS.map((kind) => {
          const list = grouped[kind];
          if (!list || list.length === 0) return null;
          return (
            <section key={kind} className="card p-5">
              <div className="flex items-baseline justify-between">
                <div className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--accent, #67e8f9)" }}>{KIND_LABEL[kind]} · {list.length}</div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {list.map((p) => {
                  const watching = alreadyUrls.has(p.url) || alreadyCatalogIds.has(p.id);
                  return (
                    <article key={p.id} className="panel p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-sm font-semibold" style={{ color: "var(--heading)" }}>{p.name}</div>
                        <span className="rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.18em]" style={{ borderColor: "var(--border)", color: "var(--faint)" }}>{TIER_LABEL[p.agencyTier]}</span>
                      </div>
                      <div className="mt-1 text-xs" style={{ color: "var(--faint)" }}>{p.agencyName ?? p.category}</div>
                      <a href={p.url} target="_blank" rel="noopener" className="mt-2 block break-all text-xs hover:underline" style={{ color: "var(--accent, #67e8f9)" }}>{p.url}</a>
                      {p.description ? <p className="mt-2 text-sm" style={{ color: "var(--body)" }}>{p.description}</p> : null}
                      <div className="mt-2 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--faint)" }}>
                        <span>{AUTH_DESC[p.authType] ?? p.authType}</span>
                        {p.geoState ? <span>· {p.geoState}</span> : null}
                        {p.geoCity ? <span>· {p.geoCity}</span> : null}
                        {p.naicsFocus ? <span>· NAICS {p.naicsFocus}</span> : null}
                        {p.setAsideFocus ? <span>· Set-aside {p.setAsideFocus}</span> : null}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {watching ? (
                          <span className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200">Watching</span>
                        ) : (
                          <form action="/api/rfp/sources/create" method="post" className="flex flex-wrap gap-2">
                            <input type="hidden" name="label" value={p.name} />
                            <input type="hidden" name="url" value={p.url} />
                            <input type="hidden" name="agencyHint" value={p.agencyName ?? p.name} />
                            <input type="hidden" name="catalogId" value={p.id} />
                            <input type="hidden" name="naicsFilter" value={p.naicsFocus ?? ""} />
                            <input type="hidden" name="setAsideFilter" value={p.setAsideFocus ?? ""} />
                            <input type="hidden" name="geoState" value={p.geoState ?? ""} />
                            <input type="hidden" name="geoCity" value={p.geoCity ?? ""} />
                            <input type="hidden" name="geoScope" value={p.geoScope} />
                            <input type="hidden" name="authType" value={p.authType} />
                            <input type="hidden" name="cadence" value={p.authType === "NONE" ? "DAILY" : "WEEKLY"} />
                            {p.signupUrl ? <a href={p.signupUrl} target="_blank" rel="noopener" className="btn-outline text-xs">Sign up first</a> : null}
                            <button type="submit" className="btn-primary text-xs">Watch this source</button>
                          </form>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </AppLayout>
  );
}
