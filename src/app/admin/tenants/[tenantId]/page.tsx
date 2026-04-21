import Link from "next/link";
import { notFound } from "next/navigation";
import { DetailShell } from "@/components/layout/detail-shell";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/prisma";
import { ProjectMode } from "@prisma/client";
import { formatDate, modeLabel } from "@/lib/utils";

const ROLE_TEMPLATES = ["ADMIN", "EXECUTIVE", "MANAGER", "PROGRAM_MANAGER", "CONTROLLER", "SUPERINTENDENT", "PROJECT_ENGINEER", "FOREMAN", "SAFETY_MANAGER", "QUALITY_MANAGER", "COORDINATOR", "VIEWER"] as const;

export default async function AdminTenantDetailPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      businessUnits: { orderBy: { name: "asc" } },
      memberships: { include: { user: true, businessUnit: true }, orderBy: { createdAt: "asc" } },
      _count: { select: { projects: true, opportunities: true, vendors: true, bidDrafts: true, journalEntries: true } },
    },
  });
  if (!tenant) notFound();
  const enabled: string[] = (() => { try { return JSON.parse(tenant.enabledModes); } catch { return []; } })();
  const featurePacks: string[] = (() => { try { return JSON.parse(tenant.featurePacks); } catch { return []; } })();
  const allUsers = await prisma.user.findMany({ orderBy: { name: "asc" } });

  return (
    <DetailShell
      eyebrow="Super admin · Tenant"
      title={tenant.name}
      subtitle={`slug: ${tenant.slug} · ${tenant._count.projects} projects · ${tenant.memberships.length} members`}
      crumbs={[{ label: "Admin", href: "/admin" }, { label: "Tenants", href: "/admin/tenants" }, { label: tenant.name }]}
      actions={<div className="flex gap-2"><form action={`/api/admin/tenants/${tenant.id}/switch`} method="post"><button className="btn-primary text-xs">Switch in</button></form></div>}
    >
      <section className="grid gap-4 md:grid-cols-5">
        <StatTile label="Projects" value={tenant._count.projects} />
        <StatTile label="Members" value={tenant.memberships.length} />
        <StatTile label="BUs" value={tenant.businessUnits.length} />
        <StatTile label="Opportunities" value={tenant._count.opportunities} />
        <StatTile label="Vendors" value={tenant._count.vendors} />
      </section>

      <section className="card p-6">
        <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Identity & modes</div>
        <form action={`/api/admin/tenants/${tenant.id}/edit`} method="post" className="mt-4 grid gap-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div><label className="form-label">Name</label><input name="name" defaultValue={tenant.name} required className="form-input" /></div>
            <div><label className="form-label">Slug</label><input name="slug" defaultValue={tenant.slug} required pattern="[a-z0-9-]+" className="form-input" /></div>
          </div>
          <div>
            <label className="form-label">Enabled modes</label>
            <div className="mt-2 grid gap-3 md:grid-cols-3">
              {Object.values(ProjectMode).map((m) => (
                <label key={m} className="panel p-3 flex items-center gap-2">
                  <input type="checkbox" name="enabledModes" value={m} defaultChecked={enabled.includes(m)} />
                  <span>{modeLabel(m)}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="form-label">Primary mode</label>
              <select name="primaryMode" defaultValue={tenant.primaryMode} className="form-select">
                {Object.values(ProjectMode).map((m) => <option key={m} value={m}>{modeLabel(m)}</option>)}
              </select>
            </div>
            <div><label className="form-label">Feature packs (comma-separated)</label><input name="featurePacks" defaultValue={featurePacks.join(",")} className="form-input" placeholder="heavy-civil, design-build, aia-g702" /></div>
          </div>
          <div><button className="btn-primary">Save changes</button></div>
        </form>
      </section>

      <section className="card p-6">
        <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Business units · {tenant.businessUnits.length}</div>
        <form action={`/api/admin/tenants/${tenant.id}/business-units/create`} method="post" className="mt-4 grid gap-3 md:grid-cols-4">
          <div><label className="form-label">Name</label><input name="name" required className="form-input" /></div>
          <div><label className="form-label">Code</label><input name="code" required className="form-input" placeholder="EAST" /></div>
          <div>
            <label className="form-label">Default mode</label>
            <select name="defaultMode" defaultValue={tenant.primaryMode} className="form-select">
              {Object.values(ProjectMode).map((m) => <option key={m} value={m}>{modeLabel(m)}</option>)}
            </select>
          </div>
          <div className="flex items-end"><button className="btn-primary w-full">+ Add</button></div>
          <div className="md:col-span-4"><label className="form-label">Region (optional)</label><input name="region" className="form-input" /></div>
        </form>
        <table className="min-w-full divide-y divide-white/10 text-sm mt-6">
          <thead className="bg-white/5"><tr>
            <th className="table-header">Name</th>
            <th className="table-header">Code</th>
            <th className="table-header">Mode</th>
            <th className="table-header">Region</th>
            <th className="table-header"></th>
          </tr></thead>
          <tbody className="divide-y divide-white/10 bg-slate-950/40">
            {tenant.businessUnits.map((b) => (
              <tr key={b.id}>
                <td className="table-cell">{b.name}</td>
                <td className="table-cell font-mono text-xs">{b.code}</td>
                <td className="table-cell">{modeLabel(b.defaultMode)}</td>
                <td className="table-cell text-slate-400">{b.region ?? "—"}</td>
                <td className="table-cell">
                  <form action={`/api/admin/tenants/${tenant.id}/business-units/${b.id}/delete`} method="post">
                    <button className="btn-outline text-xs">Delete</button>
                  </form>
                </td>
              </tr>
            ))}
            {tenant.businessUnits.length === 0 ? <tr><td colSpan={5} className="table-cell text-center text-slate-500">No business units.</td></tr> : null}
          </tbody>
        </table>
      </section>

      <section className="card p-6">
        <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Memberships · {tenant.memberships.length}</div>
        <form action={`/api/admin/tenants/${tenant.id}/memberships/create`} method="post" className="mt-4 grid gap-3 md:grid-cols-4">
          <div>
            <label className="form-label">Existing user</label>
            <select name="userId" className="form-select"><option value="">— or enter email below —</option>
              {allUsers.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.email}</option>)}
            </select>
          </div>
          <div><label className="form-label">New user name</label><input name="name" className="form-input" /></div>
          <div><label className="form-label">New user email</label><input name="email" type="email" className="form-input" /></div>
          <div>
            <label className="form-label">Role</label>
            <select name="role" defaultValue="MANAGER" className="form-select">
              {ROLE_TEMPLATES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Business unit</label>
            <select name="businessUnitId" className="form-select">
              <option value="">— none —</option>
              {tenant.businessUnits.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="md:col-span-4"><button className="btn-primary">Add member</button></div>
        </form>
        <table className="min-w-full divide-y divide-white/10 text-sm mt-6">
          <thead className="bg-white/5"><tr>
            <th className="table-header">User</th>
            <th className="table-header">Email</th>
            <th className="table-header">Role</th>
            <th className="table-header">Business unit</th>
            <th className="table-header">Joined</th>
            <th className="table-header"></th>
          </tr></thead>
          <tbody className="divide-y divide-white/10 bg-slate-950/40">
            {tenant.memberships.map((m) => (
              <tr key={m.id}>
                <td className="table-cell"><Link href={`/admin/users/${m.userId}`} className="text-cyan-300 hover:underline">{m.user.name}</Link>{m.user.superAdmin ? <span className="ml-2 rounded-full border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-200">SUPER</span> : null}</td>
                <td className="table-cell text-xs">{m.user.email}</td>
                <td className="table-cell">
                  <form action={`/api/admin/tenants/${tenant.id}/memberships/${m.id}/role`} method="post" className="flex gap-1">
                    <select name="role" defaultValue={m.roleTemplate} className="form-select text-xs">
                      {ROLE_TEMPLATES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <button className="btn-outline text-xs">Save</button>
                  </form>
                </td>
                <td className="table-cell text-xs">{m.businessUnit?.name ?? "—"}</td>
                <td className="table-cell text-xs text-slate-400">{formatDate(m.createdAt)}</td>
                <td className="table-cell">
                  <form action={`/api/admin/tenants/${tenant.id}/memberships/${m.id}/delete`} method="post">
                    <button className="btn-outline text-xs">Remove</button>
                  </form>
                </td>
              </tr>
            ))}
            {tenant.memberships.length === 0 ? <tr><td colSpan={6} className="table-cell text-center text-slate-500">No members yet.</td></tr> : null}
          </tbody>
        </table>
      </section>

      <section className="card p-6 border-rose-500/30">
        <div className="text-xs uppercase tracking-[0.2em] text-rose-300">Danger zone</div>
        <p className="mt-2 text-sm text-slate-300">Deleting a tenant cascades to every project, membership, document, opportunity, vendor, and financial record under it. This cannot be undone.</p>
        <form action={`/api/admin/tenants/${tenant.id}/delete`} method="post" className="mt-4 flex gap-3">
          <input name="confirm" placeholder={`Type "${tenant.slug}" to confirm`} required className="form-input flex-1" />
          <button className="btn-danger">Delete tenant</button>
        </form>
      </section>
    </DetailShell>
  );
}
