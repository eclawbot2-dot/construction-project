import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { StatTile } from "@/components/ui/stat-tile";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";

export default async function AdminUsersListPage({ searchParams }: { searchParams: Promise<{ q?: string; super?: string }> }) {
  const sp = await searchParams;
  const where: Record<string, unknown> = {};
  if (sp.q) where.OR = [{ name: { contains: sp.q } }, { email: { contains: sp.q } }];
  if (sp.super === "1") where.superAdmin = true;

  const [users, total, superTotal, active] = await Promise.all([
    prisma.user.findMany({ where, include: { memberships: { include: { tenant: true } } }, orderBy: { name: "asc" }, take: 500 }),
    prisma.user.count(),
    prisma.user.count({ where: { superAdmin: true } }),
    prisma.user.count({ where: { active: true } }),
  ]);

  return (
    <AppLayout eyebrow="Super admin" title="User management" description="Every user across every tenant. Promote/demote super-admin status, deactivate, inspect tenant memberships.">
      <div className="grid gap-6">
        <section className="grid gap-4 md:grid-cols-4">
          <StatTile label="Total users" value={total} />
          <StatTile label="Super admins" value={superTotal} tone={superTotal > 0 ? "good" : "bad"} />
          <StatTile label="Active" value={active} />
          <StatTile label="Shown" value={users.length} />
        </section>

        <section className="card p-5">
          <form method="get" className="grid gap-3 md:grid-cols-[2fr_1fr_auto_auto]">
            <input name="q" defaultValue={sp.q ?? ""} placeholder="Search by name or email…" className="form-input" />
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" name="super" value="1" defaultChecked={sp.super === "1"} /> Super admins only
            </label>
            <button className="btn-primary">Filter</button>
            <Link href="/admin/users/new" className="btn-outline">+ New user</Link>
          </form>
        </section>

        <section className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-sm">
              <thead className="bg-white/5">
                <tr>
                  <th className="table-header">Name</th>
                  <th className="table-header">Email</th>
                  <th className="table-header">Super admin</th>
                  <th className="table-header">Active</th>
                  <th className="table-header">Tenants</th>
                  <th className="table-header">Created</th>
                  <th className="table-header"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-slate-950/40">
                {users.map((u) => (
                  <tr key={u.id} className="transition hover:bg-white/5">
                    <td className="table-cell"><Link href={`/admin/users/${u.id}`} className="font-medium text-white hover:text-cyan-200">{u.name}</Link></td>
                    <td className="table-cell text-xs text-slate-400">{u.email}</td>
                    <td className="table-cell">{u.superAdmin ? <span className="rounded-full border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-200">YES</span> : "—"}</td>
                    <td className="table-cell">{u.active ? <span className="text-emerald-300">active</span> : <span className="text-slate-500">inactive</span>}</td>
                    <td className="table-cell text-xs">{u.memberships.length > 0 ? u.memberships.map((m) => `${m.tenant.slug}:${m.roleTemplate}`).join(", ") : "—"}</td>
                    <td className="table-cell text-xs text-slate-400">{formatDate(u.createdAt)}</td>
                    <td className="table-cell"><Link href={`/admin/users/${u.id}`} className="btn-outline text-xs">Manage</Link></td>
                  </tr>
                ))}
                {users.length === 0 ? <tr><td colSpan={7} className="table-cell text-center text-slate-500">No users match.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
