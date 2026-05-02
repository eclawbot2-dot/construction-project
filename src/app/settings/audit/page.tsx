import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { StatTile } from "@/components/ui/stat-tile";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { formatDateTime } from "@/lib/utils";

/**
 * Tenant-scoped audit log. Same structure as /admin/audit but filtered
 * to the current tenant — non-super-admin users see only their own
 * tenant's history. Useful for customers who want to review their own
 * change log without needing platform-level access.
 */

type EventRow = Awaited<ReturnType<typeof loadEvents>>[number];

async function loadEvents(tenantId: string, where: Record<string, unknown>) {
  return prisma.auditEvent.findMany({
    where: { tenantId, ...where },
    include: { actor: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
}

export default async function TenantAuditPage({ searchParams }: { searchParams: Promise<{ entityType?: string; action?: string }> }) {
  const tenant = await requireTenant();
  const sp = await searchParams;

  const where: Record<string, unknown> = {};
  if (sp.entityType) where.entityType = sp.entityType;
  if (sp.action) where.action = sp.action;

  const [events, total] = await Promise.all([
    loadEvents(tenant.id, where),
    prisma.auditEvent.count({ where: { tenantId: tenant.id } }),
  ]);

  const columns: DataTableColumn<EventRow>[] = [
    { key: "when", header: "When", cellClassName: "text-xs text-slate-400", render: (e) => formatDateTime(e.createdAt) },
    { key: "actor", header: "Actor", cellClassName: "text-xs", render: (e) => e.actor?.name ?? e.actor?.email ?? "system" },
    { key: "action", header: "Action", cellClassName: "font-mono text-xs", render: (e) => e.action },
    { key: "entity", header: "Entity", cellClassName: "text-xs", render: (e) => `${e.entityType}:${e.entityId.slice(0, 12)}${e.entityId.length > 12 ? "…" : ""}` },
    { key: "source", header: "Source", cellClassName: "text-xs text-slate-400", render: (e) => e.source ?? "—" },
  ];

  return (
    <AppLayout
      eyebrow="Settings"
      title="Audit log"
      description="Every change made within your tenant — who did what, when. Hold this for compliance evidence and security review."
    >
      <div className="grid gap-6">
        <section className="grid gap-4 md:grid-cols-3">
          <StatTile label="Total events" value={total} />
          <StatTile label="Showing" value={events.length} />
          <StatTile label="Tenant" value={tenant.name} />
        </section>
        <section className="card p-5">
          <form method="get" className="grid gap-3 md:grid-cols-3">
            <label htmlFor="audit-entity" className="sr-only">Entity type</label>
            <input id="audit-entity" name="entityType" defaultValue={sp.entityType ?? ""} placeholder="Entity type (e.g. Project, BidDraft)" className="form-input" />
            <label htmlFor="audit-action" className="sr-only">Action</label>
            <input id="audit-action" name="action" defaultValue={sp.action ?? ""} placeholder="Action (e.g. PROJECT_CREATED)" className="form-input" />
            <div className="flex gap-2">
              <button className="btn-primary flex-1">Filter</button>
              <Link href="/settings/audit" className="btn-outline">Clear</Link>
            </div>
          </form>
        </section>

        <DataTable
          columns={columns}
          rows={events}
          rowKey={(e) => e.id}
          emptyMessage="No events yet — they'll appear as you use the app."
        />
      </div>
    </AppLayout>
  );
}
