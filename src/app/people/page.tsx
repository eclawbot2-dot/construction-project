import { AppLayout } from "@/components/layout/app-layout";
import { prisma } from "@/lib/prisma";
import { formatDate, roleLabel } from "@/lib/utils";

export default async function PeoplePage() {
  const users = await prisma.user.findMany({
    include: { memberships: { include: { businessUnit: true, tenant: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <AppLayout eyebrow="People" title="People & roles" description="Team members, role templates, and business-unit assignments across the tenant.">
      <div className="grid gap-6">
        <section className="grid gap-4 md:grid-cols-4">
          <Stat label="Total team members" value={users.length} />
          <Stat label="Active" value={users.filter((u) => u.active).length} tone="good" />
          <Stat label="Memberships" value={users.reduce((s, u) => s + u.memberships.length, 0)} />
          <Stat label="Role templates in use" value={Array.from(new Set(users.flatMap((u) => u.memberships.map((m) => m.roleTemplate)))).length} />
        </section>
        <section className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-white/5">
                <tr>
                  <th className="table-header">Name</th>
                  <th className="table-header">Email</th>
                  <th className="table-header">Roles</th>
                  <th className="table-header">Business units</th>
                  <th className="table-header">Active since</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-slate-950/40">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="table-cell font-medium text-white">{u.name}</td>
                    <td className="table-cell text-slate-400">{u.email}</td>
                    <td className="table-cell">{Array.from(new Set(u.memberships.map((m) => roleLabel(m.roleTemplate)))).join(", ") || "—"}</td>
                    <td className="table-cell text-slate-400">{u.memberships.map((m) => m.businessUnit?.name).filter(Boolean).join(", ") || "—"}</td>
                    <td className="table-cell text-slate-400">{formatDate(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: "good" | "warn" | "bad" }) {
  const toneClass = tone === "good" ? "text-emerald-300" : tone === "warn" ? "text-amber-300" : tone === "bad" ? "text-rose-300" : "text-white";
  return <div className="panel p-4"><div className="text-xs uppercase tracking-[0.16em] text-slate-400">{label}</div><div className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</div></div>;
}
