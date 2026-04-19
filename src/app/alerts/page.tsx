import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { formatDate } from "@/lib/utils";

export default async function AlertsPage() {
  const tenant = await requireTenant();
  const events = await prisma.alertEvent.findMany({ where: { tenantId: tenant.id, acknowledgedAt: null }, orderBy: [{ severity: "asc" }, { createdAt: "desc" }] });
  const bySeverity = { ALERT: 0, WARN: 0, INFO: 0 } as Record<string, number>;
  for (const e of events) bySeverity[e.severity] = (bySeverity[e.severity] ?? 0) + 1;

  return (
    <AppLayout eyebrow="What needs my attention" title="Alerts" description="Permit expiry, insurance lapsing, overdue RFIs, budget over-runs, failed inspections without follow-up — all in one feed.">
      <div className="grid gap-6">
        <section className="grid gap-4 md:grid-cols-4">
          <StatTile label="Urgent" value={bySeverity.ALERT ?? 0} tone={bySeverity.ALERT > 0 ? "bad" : "good"} />
          <StatTile label="Warnings" value={bySeverity.WARN ?? 0} tone={bySeverity.WARN > 0 ? "warn" : "good"} />
          <StatTile label="Info" value={bySeverity.INFO ?? 0} />
          <div className="panel p-4 flex flex-col justify-center">
            <form action="/api/alerts/scan" method="post">
              <button className="btn-primary text-sm">Run alert scan now</button>
            </form>
            <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-slate-500">Scans permits, insurance, RFIs, commitments, inspections</div>
          </div>
        </section>
        <section className="grid gap-3">
          {events.map((e) => (
            <div key={e.id} className={`card p-4 border-l-4 ${e.severity === "ALERT" ? "border-l-rose-500" : e.severity === "WARN" ? "border-l-amber-500" : "border-l-cyan-500"}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <StatusBadge tone={e.severity === "ALERT" ? "bad" : e.severity === "WARN" ? "warn" : "info"} label={e.severity} />
                    <span className="text-xs uppercase tracking-[0.18em] text-slate-500">{e.entityType}</span>
                  </div>
                  <div className="mt-2 text-sm font-semibold text-white">{e.title}</div>
                  {e.body ? <div className="mt-1 text-sm text-slate-300">{e.body}</div> : null}
                  <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-slate-500">{formatDate(e.createdAt)}</div>
                </div>
                {e.link ? <Link href={e.link} className="btn-outline text-xs">Open →</Link> : null}
              </div>
            </div>
          ))}
          {events.length === 0 ? <div className="card p-8 text-center text-slate-500">No open alerts. Run scan to check.</div> : null}
        </section>
      </div>
    </AppLayout>
  );
}
