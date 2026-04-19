import Link from "next/link";
import { notFound } from "next/navigation";
import { DetailShell, DetailGrid, DetailField } from "@/components/layout/detail-shell";
import { StatTile } from "@/components/ui/stat-tile";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { formatDate, roleLabel } from "@/lib/utils";

export default async function UserDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const tenant = await requireTenant();
  const user = await prisma.user.findFirst({
    where: { id: userId, memberships: { some: { tenantId: tenant.id } } },
    include: {
      memberships: { where: { tenantId: tenant.id }, include: { businessUnit: true, tenant: true } },
      tasks: { where: { project: { tenantId: tenant.id } }, include: { project: true }, orderBy: { dueDate: "asc" }, take: 25 },
      messages: { take: 10, orderBy: { createdAt: "desc" }, include: { thread: { include: { project: true } } } },
    },
  });
  if (!user) notFound();

  const roles = Array.from(new Set(user.memberships.map((m) => roleLabel(m.roleTemplate))));
  const units = Array.from(new Set(user.memberships.map((m) => m.businessUnit?.name).filter(Boolean)));
  const openTasks = user.tasks.filter((t) => t.status !== "COMPLETE").length;

  return (
    <DetailShell
      eyebrow="Team member"
      title={user.name}
      subtitle={user.email}
      crumbs={[{ label: "People", href: "/people" }, { label: user.name }]}
    >
      <section className="grid gap-4 md:grid-cols-4">
        <StatTile label="Roles (current tenant)" value={roles.length} sub={roles.join(" · ") || "—"} />
        <StatTile label="Business units" value={units.length} sub={units.join(" · ") || "—"} />
        <StatTile label="Open tasks" value={openTasks} tone={openTasks > 0 ? "warn" : "good"} />
        <StatTile label="Recent thread messages" value={user.messages.length} />
      </section>

      <section className="card p-6">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Member detail</div>
        <DetailGrid>
          <DetailField label="Name">{user.name}</DetailField>
          <DetailField label="Email">{user.email}</DetailField>
          <DetailField label="Active">{user.active ? "Yes" : "No"}</DetailField>
          <DetailField label="Joined">{formatDate(user.createdAt)}</DetailField>
        </DetailGrid>
      </section>

      <section className="card p-0 overflow-hidden">
        <div className="px-5 py-3 text-xs uppercase tracking-[0.2em] text-slate-400">Role memberships</div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10">
            <thead className="bg-white/5">
              <tr>
                <th className="table-header">Tenant</th>
                <th className="table-header">Business unit</th>
                <th className="table-header">Role</th>
                <th className="table-header">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 bg-slate-950/40">
              {user.memberships.map((m) => (
                <tr key={m.id}>
                  <td className="table-cell">{m.tenant.name}</td>
                  <td className="table-cell">{m.businessUnit?.name ?? "—"}</td>
                  <td className="table-cell">{roleLabel(m.roleTemplate)}</td>
                  <td className="table-cell text-slate-400">{formatDate(m.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card p-0 overflow-hidden">
        <div className="px-5 py-3 text-xs uppercase tracking-[0.2em] text-slate-400">Assigned tasks</div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10">
            <thead className="bg-white/5">
              <tr>
                <th className="table-header">Project</th>
                <th className="table-header">Task</th>
                <th className="table-header">Priority</th>
                <th className="table-header">Due</th>
                <th className="table-header">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 bg-slate-950/40">
              {user.tasks.map((t) => (
                <tr key={t.id} className="transition hover:bg-white/5">
                  <td className="table-cell"><Link href={`/projects/${t.project.id}/tasks`} className="text-cyan-300 hover:underline">{t.project.code}</Link></td>
                  <td className="table-cell">{t.title}</td>
                  <td className="table-cell">{t.priority}</td>
                  <td className="table-cell text-slate-400">{formatDate(t.dueDate)}</td>
                  <td className="table-cell">{t.status.replaceAll("_", " ")}</td>
                </tr>
              ))}
              {user.tasks.length === 0 ? <tr><td colSpan={5} className="table-cell text-center text-slate-500">No tasks assigned.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </DetailShell>
  );
}
