import { AppLayout } from "@/components/layout/app-layout";
import { getDashboardData } from "@/lib/dashboard";
import { formatDateTime } from "@/lib/utils";

export default async function AuditPage() {
  const data = await getDashboardData();

  return (
    <AppLayout
      eyebrow="Pass 5 — Auditability"
      title="Audit Trail"
      description="Tenant-level audit visibility for seeded project activity, with a clear path to immutable write-event logging and export controls."
    >
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <section className="card p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Recent audit events</div>
          <div className="mt-4 space-y-3">
            {data?.auditTrail.map((event) => (
              <div key={event.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="font-medium text-white">{event.action} · {event.entityType}</div>
                  <div className="text-xs text-slate-500">{formatDateTime(event.createdAt)}</div>
                </div>
                <div className="mt-1 text-sm text-slate-300">Actor: {event.actorName}</div>
                <div className="mt-1 text-xs text-slate-500">Source: {event.source ?? "system"}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="card p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Audit requirements coverage</div>
          <div className="mt-4 grid gap-3 text-sm text-slate-300">
            {[
              "Immutable audit trail for critical records is modeled and visible in the tenant surface",
              "Field-history level before/after values are represented in schema but need broad write-path implementation",
              "Exportable audit logs and legal hold controls are documented next-phase requirements",
              "Approval evidence should be attached to RFI, submittal, budget, and change workflows",
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/5 p-4">{item}</div>
            ))}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
