import { AppLayout } from "@/components/layout/app-layout";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { formatDateTime } from "@/lib/utils";

/**
 * Guest accounts — owners, architects, inspectors, subs given
 * scoped read access to specific resources via magic link. Free
 * named seats (no paid license). Lets the GC bring outside
 * collaborators in without per-seat cost.
 */
export default async function GuestsPage() {
  const tenant = await requireTenant();
  const guests = await prisma.guestAccount.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <AppLayout eyebrow="Settings · Collaborators" title="Guest accounts" description="Free named seats for owner / architect / inspector / sub. Magic-link sign-in; scoped read access.">
      <div className="grid gap-6">
        <section className="card p-5">
          <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Invite guest</div>
          <form action="/api/tenant/guests/create" method="post" className="mt-3 grid gap-3 md:grid-cols-[2fr_2fr_1fr_auto]">
            <input name="email" type="email" required placeholder="email@example.com" className="form-input" />
            <input name="name" placeholder="Name" className="form-input" />
            <select name="role" defaultValue="OWNER_REVIEWER" className="form-select">
              <option value="OWNER_REVIEWER">Owner / Reviewer</option>
              <option value="ARCHITECT">Architect</option>
              <option value="INSPECTOR">Inspector</option>
              <option value="SUB">Sub</option>
            </select>
            <button className="btn-primary">Invite</button>
          </form>
          <p className="mt-2 text-xs text-slate-500">Guest receives a magic link by email (no password). Access scope can be limited to specific projects via the JSON scope field.</p>
        </section>

        <section className="card p-0 overflow-hidden">
          <table className="min-w-full divide-y divide-white/10 text-sm">
            <thead className="bg-white/5">
              <tr>
                <th className="table-header">Email</th>
                <th className="table-header">Name</th>
                <th className="table-header">Role</th>
                <th className="table-header">Last seen</th>
                <th className="table-header">Active</th>
                <th className="table-header" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {guests.map((g) => (
                <tr key={g.id} className={g.active ? "" : "opacity-50"}>
                  <td className="table-cell">{g.email}</td>
                  <td className="table-cell">{g.name ?? "—"}</td>
                  <td className="table-cell text-xs">{g.role}</td>
                  <td className="table-cell text-xs">{g.lastSeenAt ? formatDateTime(g.lastSeenAt) : "—"}</td>
                  <td className="table-cell">{g.active ? "✓" : "—"}</td>
                  <td className="table-cell">
                    <form action={`/api/tenant/guests/${g.id}/toggle`} method="post">
                      <button className="btn-outline text-xs">{g.active ? "Disable" : "Enable"}</button>
                    </form>
                  </td>
                </tr>
              ))}
              {guests.length === 0 ? <tr><td colSpan={6} className="table-cell text-center text-slate-500 py-4">No guest accounts yet.</td></tr> : null}
            </tbody>
          </table>
        </section>
      </div>
    </AppLayout>
  );
}
