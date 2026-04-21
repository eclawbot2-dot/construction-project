import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { StatTile } from "@/components/ui/stat-tile";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";

export default async function AdminHomePage() {
  const [tenants, users, superAdmins, projects, membershipsTotal, lastAudit] = await Promise.all([
    prisma.tenant.count(),
    prisma.user.count(),
    prisma.user.count({ where: { superAdmin: true } }),
    prisma.project.count(),
    prisma.membership.count(),
    prisma.auditEvent.findFirst({ orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <AppLayout eyebrow="Super admin" title="Platform administration" description="Manage tenants, users, memberships, and platform-level settings across the entire install.">
      <div className="grid gap-6">
        <section className="grid gap-4 md:grid-cols-5">
          <StatTile label="Tenants" value={tenants} href="/admin/tenants" />
          <StatTile label="Users" value={users} href="/admin/users" />
          <StatTile label="Super admins" value={superAdmins} tone={superAdmins > 0 ? "good" : "bad"} />
          <StatTile label="Memberships" value={membershipsTotal} />
          <StatTile label="Projects (all tenants)" value={projects} />
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <Tile href="/admin/tenants" title="Tenant management" body="Create tenants, edit identity & modes, see per-tenant project counts, disable or delete." />
          <Tile href="/admin/users" title="User management" body="All users across the platform. Promote/demote super admin. Deactivate." />
          <Tile href="/admin/audit" title="Audit log" body="Platform-wide audit events. Filter by actor, tenant, entity type." />
          <Tile href="/admin/tenants/new" title="+ New tenant" body="Spin up a new tenant with a primary mode, enabled modes, and an ADMIN user." />
          <Tile href="/admin/users/new" title="+ New user" body="Create a platform user. Optionally promote to super admin on creation." />
          <Tile href="/settings" title="← Back to my tenant" body="Return to tenant-scoped settings for whichever tenant you currently have active." />
        </section>

        <section className="card p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Last audit event</div>
          <div className="mt-2 text-sm">
            {lastAudit ? (
              <>
                <span className="font-semibold text-white">{lastAudit.action}</span>{" "}
                on <span className="font-mono text-cyan-200">{lastAudit.entityType}</span>{" "}
                · {formatDateTime(lastAudit.createdAt)}
              </>
            ) : <span className="text-slate-500">no audit events yet</span>}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}

function Tile({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link href={href} className="card p-6 transition hover:border-cyan-500/50">
      <div className="text-lg font-semibold text-white">{title}</div>
      <p className="mt-2 text-sm text-slate-400">{body}</p>
    </Link>
  );
}
