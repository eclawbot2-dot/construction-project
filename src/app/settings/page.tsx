import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { StatTile } from "@/components/ui/stat-tile";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { formatDate, modeLabel, roleLabel } from "@/lib/utils";
import { ProjectMode } from "@prisma/client";

const ROLE_TEMPLATES = ["ADMIN", "EXECUTIVE", "MANAGER", "PROJECT_ENGINEER", "SUPERINTENDENT", "FOREMAN", "CONTROLLER", "SAFETY_MANAGER", "QUALITY_MANAGER", "VIEWER"] as const;

const MODE_DESCRIPTIONS: Record<string, string> = {
  SIMPLE: "Simple Construction PM — remodels, custom homes, single-trade GCs. Job-thread-first UX, lightweight tasks, homeowner portal-ready.",
  VERTICAL: "Vertical Building — commercial, multifamily, institutional. Full RFI / submittal / OAC meeting / drawing-register workflows.",
  HEAVY_CIVIL: "Heavy Civil — utilities, roadway, earthwork. Quantity-earned-value, ticket reconciliation, production rates, location tagging.",
};

export default async function SettingsPage() {
  const tenant = await requireTenant();
  const allTenants = await prisma.tenant.findMany({ orderBy: { name: "asc" } });
  const projectsByMode = await prisma.project.groupBy({
    by: ["mode"],
    where: { tenantId: tenant.id },
    _count: { _all: true },
  });
  const [memberships, businessUnits] = await Promise.all([
    prisma.membership.findMany({ where: { tenantId: tenant.id }, include: { user: true, businessUnit: true }, orderBy: { createdAt: "asc" } }),
    prisma.businessUnit.findMany({ where: { tenantId: tenant.id }, orderBy: { name: "asc" } }),
  ]);
  const enabled: string[] = (() => {
    try { return JSON.parse(tenant.enabledModes); } catch { return []; }
  })();

  return (
    <AppLayout eyebrow="Tenant settings" title={`Configure ${tenant.name}`} description="Primary operating mode, enabled modes, and tenant identity. Changes here reshape the UI and workflow coverage for every project in this tenant.">
      <div className="grid gap-6">
        <section className="grid gap-4 md:grid-cols-3">
          <StatTile label="Tenant" value={tenant.name} sub={`slug: ${tenant.slug}`} />
          <StatTile label="Primary mode" value={modeLabel(tenant.primaryMode)} sub={`${enabled.length} modes enabled`} />
          <StatTile label="Other tenants" value={allTenants.length - 1} sub="switch via header" />
        </section>

        <section className="card p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Operating modes</div>
          <p className="mt-1 text-sm text-slate-400">Companies typically grow across modes. Enable the ones this organization actually uses and pick the primary — most dashboards default to the primary mode&apos;s layout.</p>
          <form action="/api/tenant/config" method="post" className="mt-5 grid gap-6">
            <input type="hidden" name="redirect" value="/settings" />
            <div className="grid gap-4">
              {Object.values(ProjectMode).map((mode) => {
                const count = projectsByMode.find((r) => r.mode === mode)?._count._all ?? 0;
                const isEnabled = enabled.includes(mode);
                const isPrimary = tenant.primaryMode === mode;
                return (
                  <label key={mode} className={`flex flex-col gap-3 rounded-2xl border p-5 transition ${isPrimary ? "border-cyan-500/40 bg-cyan-500/5" : isEnabled ? "border-white/10 bg-white/5" : "border-white/5 bg-white/[0.02]"}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <input type="checkbox" name="enabledModes" value={mode} defaultChecked={isEnabled} className="h-4 w-4" />
                          <span className="text-lg font-semibold text-white">{modeLabel(mode)}</span>
                          {isPrimary ? <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200">Primary</span> : null}
                        </div>
                        <p className="mt-2 max-w-2xl text-sm text-slate-400">{MODE_DESCRIPTIONS[mode]}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Projects in this mode</div>
                        <div className="mt-1 text-2xl font-semibold text-white">{count}</div>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-[0.16em] text-slate-400">Primary mode</span>
                <select
                  name="primaryMode"
                  defaultValue={tenant.primaryMode}
                  className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
                >
                  {Object.values(ProjectMode).map((m) => (
                    <option key={m} value={m}>{modeLabel(m)}</option>
                  ))}
                </select>
              </label>
              <button type="submit" className="btn-primary">Save mode config</button>
            </div>
          </form>
        </section>

        <section className="card p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">All tenants on this platform</div>
          <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-white/5">
                <tr>
                  <th className="table-header">Name</th>
                  <th className="table-header">Slug</th>
                  <th className="table-header">Primary mode</th>
                  <th className="table-header">Enabled modes</th>
                  <th className="table-header">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-slate-950/40">
                {allTenants.map((t) => {
                  let tEnabled: string[] = [];
                  try { tEnabled = JSON.parse(t.enabledModes); } catch { tEnabled = []; }
                  return (
                    <tr key={t.id} className={t.id === tenant.id ? "bg-cyan-500/5" : ""}>
                      <td className="table-cell">
                        <div className="font-medium text-white">{t.name}</div>
                        {t.id === tenant.id ? <div className="text-xs text-cyan-300">current</div> : null}
                      </td>
                      <td className="table-cell font-mono text-xs text-slate-400">{t.slug}</td>
                      <td className="table-cell">{modeLabel(t.primaryMode)}</td>
                      <td className="table-cell">
                        <div className="flex flex-wrap gap-1">
                          {tEnabled.map((m) => <span key={m} className="badge-gray text-[10px]">{modeLabel(m)}</span>)}
                        </div>
                      </td>
                      <td className="table-cell text-slate-400">{formatDate(t.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500">Use the tenant switcher in the header to jump between companies. Each tenant sees only its own projects, vendors, contracts, and financials.</p>
        </section>

        <section className="card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Team + role management</div>
              <p className="mt-1 text-sm text-slate-400">Invite teammates into this tenant and assign role templates. Existing users get their membership updated.</p>
            </div>
            <Link href="/people" className="btn-outline text-xs">Open people directory</Link>
          </div>
          <form action="/api/users/invite" method="post" className="mt-4 grid gap-3 md:grid-cols-[2fr_2fr_1fr_1fr_auto]">
            <input name="name" required placeholder="Full name" className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500" />
            <input name="email" type="email" required placeholder="email@company.com" className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500" />
            <select name="role" defaultValue="PROJECT_ENGINEER" className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500">
              {ROLE_TEMPLATES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
            </select>
            <select name="businessUnitId" defaultValue="" className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500">
              <option value="">— no BU —</option>
              {businessUnits.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <button className="btn-primary">Invite / update</button>
          </form>
          <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
            <table className="min-w-full divide-y divide-white/10 text-sm">
              <thead className="bg-white/5">
                <tr>
                  <th className="table-header">Name</th>
                  <th className="table-header">Email</th>
                  <th className="table-header">Role</th>
                  <th className="table-header">Business unit</th>
                  <th className="table-header">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-slate-950/40">
                {memberships.map((m) => (
                  <tr key={m.id} className="transition hover:bg-white/5">
                    <td className="table-cell"><Link href={`/people/${m.user.id}`} className="text-cyan-300 hover:underline">{m.user.name}</Link></td>
                    <td className="table-cell text-slate-400">{m.user.email}</td>
                    <td className="table-cell">{roleLabel(m.roleTemplate)}</td>
                    <td className="table-cell text-slate-400">{m.businessUnit?.name ?? "—"}</td>
                    <td className="table-cell text-slate-400">{formatDate(m.createdAt)}</td>
                  </tr>
                ))}
                {memberships.length === 0 ? <tr><td colSpan={5} className="table-cell text-center text-slate-500">No memberships yet.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Identity provider (SSO)</div>
          <p className="mt-1 text-sm text-slate-400">bcon ships with local password auth. For production tenants, hook an external OIDC provider here.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {["Auth0", "Okta", "Azure AD / Entra ID"].map((provider) => (
              <div key={provider} className="panel p-4">
                <div className="text-sm font-semibold text-white">{provider}</div>
                <p className="mt-2 text-xs text-slate-400">OIDC connector. Paste issuer URL + client ID + client secret to enable SAML/OIDC sign-in for this tenant.</p>
                <button className="btn-outline text-xs mt-3" disabled>Coming soon</button>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[10px] uppercase tracking-[0.18em] text-slate-500">SSO wiring is scaffolded but not live — contact support to enable for production.</p>
        </section>
      </div>
    </AppLayout>
  );
}
