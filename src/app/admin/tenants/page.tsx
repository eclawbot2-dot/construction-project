import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { StatTile } from "@/components/ui/stat-tile";
import { prisma } from "@/lib/prisma";
import { formatDate, modeLabel } from "@/lib/utils";

export default async function AdminTenantsListPage() {
  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { projects: true, memberships: true, businessUnits: true } } },
  });

  return (
    <AppLayout eyebrow="Super admin" title="Tenant management" description="All tenants on this install. Create, configure, switch into, or disable.">
      <div className="grid gap-6">
        <section className="grid gap-4 md:grid-cols-4">
          <StatTile label="Total tenants" value={tenants.length} />
          <StatTile label="Total projects (all)" value={tenants.reduce((s, t) => s + t._count.projects, 0)} />
          <StatTile label="Total memberships" value={tenants.reduce((s, t) => s + t._count.memberships, 0)} />
          <StatTile label="Business units" value={tenants.reduce((s, t) => s + t._count.businessUnits, 0)} />
        </section>

        <div className="flex gap-2">
          <Link href="/admin/tenants/new" className="btn-primary">+ Create new tenant</Link>
        </div>

        <section className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-sm">
              <thead className="bg-white/5">
                <tr>
                  <th className="table-header">Name</th>
                  <th className="table-header">Slug</th>
                  <th className="table-header">Primary mode</th>
                  <th className="table-header">Projects</th>
                  <th className="table-header">Members</th>
                  <th className="table-header">BUs</th>
                  <th className="table-header">Created</th>
                  <th className="table-header"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-slate-950/40">
                {tenants.map((t) => (
                  <tr key={t.id} className="transition hover:bg-white/5">
                    <td className="table-cell"><Link href={`/admin/tenants/${t.id}`} className="font-medium text-white hover:text-cyan-200">{t.name}</Link></td>
                    <td className="table-cell font-mono text-xs text-slate-400">{t.slug}</td>
                    <td className="table-cell">{modeLabel(t.primaryMode)}</td>
                    <td className="table-cell">{t._count.projects}</td>
                    <td className="table-cell">{t._count.memberships}</td>
                    <td className="table-cell">{t._count.businessUnits}</td>
                    <td className="table-cell text-slate-400">{formatDate(t.createdAt)}</td>
                    <td className="table-cell">
                      <div className="flex gap-1">
                        <Link href={`/admin/tenants/${t.id}`} className="btn-outline text-xs">Manage</Link>
                        <form action={`/api/admin/tenants/${t.id}/switch`} method="post">
                          <button className="btn-outline text-xs" title="Switch into this tenant">Switch in</button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
                {tenants.length === 0 ? <tr><td colSpan={8} className="table-cell text-center text-slate-500">No tenants yet — create one above.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
