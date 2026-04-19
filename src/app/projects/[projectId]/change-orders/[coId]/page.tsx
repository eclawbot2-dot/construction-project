import { notFound } from "next/navigation";
import { DetailShell, DetailGrid, DetailField } from "@/components/layout/detail-shell";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { changeOrderKindLabel, formatCurrency, formatDate } from "@/lib/utils";

export default async function ChangeOrderDetailPage({ params }: { params: Promise<{ projectId: string; coId: string }> }) {
  const { projectId, coId } = await params;
  const tenant = await requireTenant();
  const co = await prisma.changeOrder.findFirst({
    where: { id: coId, project: { id: projectId, tenantId: tenant.id } },
    include: { project: true, lines: { orderBy: { createdAt: "asc" } } },
  });
  if (!co) notFound();

  const subtotal = co.lines.reduce((s, l) => s + l.amount, 0);
  const markup = subtotal * (co.markupPct / 100);
  const calculated = subtotal + markup;
  const byCategory = co.lines.reduce<Record<string, number>>((acc, l) => { acc[l.category] = (acc[l.category] ?? 0) + l.amount; return acc; }, {});

  return (
    <DetailShell
      eyebrow={`${co.project.code} · Change order`}
      title={`${co.coNumber} — ${co.title}`}
      subtitle={co.description ?? undefined}
      crumbs={[{ label: "Projects", href: "/projects" }, { label: co.project.code, href: `/projects/${co.project.id}` }, { label: "Change orders", href: `/projects/${co.project.id}/change-orders` }, { label: co.coNumber }]}
      actions={(
        <div className="flex items-center gap-2">
          <StatusBadge status={co.status} />
          {co.scheduleImpactDays > 0 && (co.status === "APPROVED" || co.status === "EXECUTED") ? (
            <form action={`/api/change-orders/${co.id}/apply-schedule`} method="post">
              <button className="btn-primary text-xs">Apply +{co.scheduleImpactDays}d to schedule</button>
            </form>
          ) : null}
        </div>
      )}
    >
      <section className="grid gap-4 md:grid-cols-4">
        <StatTile label="Kind" value={changeOrderKindLabel(co.kind)} />
        <StatTile label="Net amount" value={formatCurrency(co.amount)} tone="good" />
        <StatTile label="Schedule impact" value={co.scheduleImpactDays ? `${co.scheduleImpactDays}d` : "0d"} tone={co.scheduleImpactDays > 0 ? "warn" : "default"} />
        <StatTile label="Markup %" value={`${co.markupPct}%`} />
      </section>

      <section className="card p-6">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Change order detail</div>
        <DetailGrid>
          <DetailField label="CO number">{co.coNumber}</DetailField>
          <DetailField label="Kind">{changeOrderKindLabel(co.kind)}</DetailField>
          <DetailField label="Reason">{co.reason ?? "—"}</DetailField>
          <DetailField label="Requested">{formatDate(co.requestedAt)}</DetailField>
          <DetailField label="Approved">{formatDate(co.approvedAt)}</DetailField>
          <DetailField label="Executed">{formatDate(co.executedAt)}</DetailField>
          <DetailField label="Linked RFI">{co.linkedRfiId ?? "—"}</DetailField>
          <DetailField label="Linked submittal">{co.linkedSubmittalId ?? "—"}</DetailField>
        </DetailGrid>
      </section>

      <section className="card p-6">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Cost breakdown</div>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {Object.entries(byCategory).map(([cat, amt]) => (
            <div key={cat} className="panel p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-400">{cat}</div>
              <div className="mt-2 text-xl font-semibold text-white">{formatCurrency(amt)}</div>
            </div>
          ))}
        </div>
        <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
          <table className="min-w-full divide-y divide-white/10">
            <thead className="bg-white/5">
              <tr>
                <th className="table-header">Cost code</th>
                <th className="table-header">Description</th>
                <th className="table-header">Category</th>
                <th className="table-header">Qty</th>
                <th className="table-header">Unit</th>
                <th className="table-header">Unit cost</th>
                <th className="table-header">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 bg-slate-950/40">
              {co.lines.map((l) => (
                <tr key={l.id}>
                  <td className="table-cell font-mono text-xs text-slate-400">{l.costCode ?? "—"}</td>
                  <td className="table-cell">{l.description}</td>
                  <td className="table-cell">{l.category}</td>
                  <td className="table-cell">{l.quantity}</td>
                  <td className="table-cell text-slate-400">{l.unit ?? "—"}</td>
                  <td className="table-cell">{formatCurrency(l.unitCost)}</td>
                  <td className="table-cell font-medium text-white">{formatCurrency(l.amount)}</td>
                </tr>
              ))}
              <tr className="bg-white/5">
                <td className="table-cell" colSpan={6}><span className="text-slate-400">Subtotal</span></td>
                <td className="table-cell font-semibold text-white">{formatCurrency(subtotal)}</td>
              </tr>
              <tr className="bg-white/5">
                <td className="table-cell" colSpan={6}><span className="text-slate-400">Markup ({co.markupPct}%)</span></td>
                <td className="table-cell font-semibold text-white">{formatCurrency(markup)}</td>
              </tr>
              <tr className="bg-cyan-500/10">
                <td className="table-cell" colSpan={6}><span className="text-cyan-200">Calculated total</span></td>
                <td className="table-cell font-semibold text-cyan-100">{formatCurrency(calculated)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </DetailShell>
  );
}
