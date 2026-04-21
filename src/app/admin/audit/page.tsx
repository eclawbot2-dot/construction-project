import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { StatTile } from "@/components/ui/stat-tile";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<{ entityType?: string; action?: string; tenantId?: string }> }) {
  const sp = await searchParams;
  const where: Record<string, unknown> = {};
  if (sp.entityType) where.entityType = sp.entityType;
  if (sp.action) where.action = sp.action;
  if (sp.tenantId) where.tenantId = sp.tenantId;

  const [events, total, tenants] = await Promise.all([
    prisma.auditEvent.findMany({ where, include: { actor: true, tenant: true }, orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.auditEvent.count(),
    prisma.tenant.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, slug: true } }),
  ]);

  return (
    <AppLayout eyebrow="Super admin" title="Audit log" description="Platform-wide audit events across all tenants. Filter by entity type, action, or tenant.">
      <div className="grid gap-6">
        <section className="grid gap-4 md:grid-cols-3">
          <StatTile label="Total events" value={total} />
          <StatTile label="Events shown" value={events.length} />
          <StatTile label="Tenants" value={tenants.length} />
        </section>
        <section className="card p-5">
          <form method="get" className="grid gap-3 md:grid-cols-4">
            <input name="entityType" defaultValue={sp.entityType ?? ""} placeholder="Entity type (e.g. Tenant, Membership)" className="form-input" />
            <input name="action" defaultValue={sp.action ?? ""} placeholder="Action (e.g. TENANT_CREATED)" className="form-input" />
            <select name="tenantId" defaultValue={sp.tenantId ?? ""} className="form-select">
              <option value="">All tenants</option>
              {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <div className="flex gap-2"><button className="btn-primary flex-1">Filter</button><Link href="/admin/audit" className="btn-outline">Clear</Link></div>
          </form>
        </section>
        <section className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-sm">
              <thead className="bg-white/5">
                <tr>
                  <th className="table-header">When</th>
                  <th className="table-header">Tenant</th>
                  <th className="table-header">Actor</th>
                  <th className="table-header">Action</th>
                  <th className="table-header">Entity</th>
                  <th className="table-header">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-slate-950/40">
                {events.map((e) => (
                  <tr key={e.id}>
                    <td className="table-cell text-xs text-slate-400">{formatDateTime(e.createdAt)}</td>
                    <td className="table-cell text-xs">{e.tenant?.slug ?? e.tenantId}</td>
                    <td className="table-cell text-xs">{e.actor?.name ?? "—"}</td>
                    <td className="table-cell font-mono text-xs">{e.action}</td>
                    <td className="table-cell text-xs">{e.entityType}:{e.entityId.slice(0, 10)}</td>
                    <td className="table-cell text-xs text-slate-400">{e.source ?? "—"}</td>
                  </tr>
                ))}
                {events.length === 0 ? <tr><td colSpan={6} className="table-cell text-center text-slate-500">No events match.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
