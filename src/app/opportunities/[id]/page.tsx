import { notFound } from "next/navigation";
import Link from "next/link";
import { DetailShell, DetailGrid, DetailField } from "@/components/layout/detail-shell";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { formatCurrency, formatDate, modeLabel } from "@/lib/utils";

export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await requireTenant();
  const opp = await prisma.opportunity.findFirst({
    where: { id, tenantId: tenant.id },
    include: { project: true },
  });
  if (!opp) notFound();

  const weighted = opp.estimatedValue * (opp.probability / 100);
  const daysToDue = opp.dueDate ? Math.round((new Date(opp.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

  const awarded = opp.stage === "AWARDED" && !opp.projectId;
  return (
    <DetailShell
      eyebrow="Opportunity"
      title={opp.name}
      subtitle={opp.clientName ? `${opp.clientName} · ${modeLabel(opp.mode)}` : modeLabel(opp.mode)}
      crumbs={[{ label: "Bid Hub", href: "/bids" }, { label: opp.name }]}
      actions={(
        <div className="flex items-center gap-2">
          <StatusBadge status={opp.stage} />
          <Link href={`/opportunities/${opp.id}/win`} className="btn-outline text-xs">AI · Win model</Link>
          {awarded ? (
            <form action={`/api/opportunities/${opp.id}/convert`} method="post">
              <button className="btn-primary text-xs">Create project from this award →</button>
            </form>
          ) : null}
        </div>
      )}
    >
      <section className="grid gap-4 md:grid-cols-4">
        <StatTile label="Estimated value" value={formatCurrency(opp.estimatedValue)} />
        <StatTile label="Probability" value={`${opp.probability}%`} tone={opp.probability >= 50 ? "good" : "warn"} />
        <StatTile label="Weighted value" value={formatCurrency(weighted)} tone="good" />
        <StatTile label="Days to due" value={daysToDue === null ? "—" : daysToDue < 0 ? "overdue" : `${daysToDue}d`} tone={daysToDue !== null && daysToDue < 7 ? "warn" : "default"} />
      </section>

      <section className="card p-6">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Opportunity detail</div>
        <DetailGrid>
          <DetailField label="Stage">{opp.stage.replaceAll("_", " ")}</DetailField>
          <DetailField label="Mode">{modeLabel(opp.mode)}</DetailField>
          <DetailField label="Client">{opp.clientName ?? "—"}</DetailField>
          <DetailField label="Owner">{opp.ownerName ?? "—"}</DetailField>
          <DetailField label="Source">{opp.source ?? "—"}</DetailField>
          <DetailField label="Due">{formatDate(opp.dueDate)}</DetailField>
          <DetailField label="Award date">{formatDate(opp.awardDate)}</DetailField>
          <DetailField label="Linked project">{opp.project ? <Link href={`/projects/${opp.project.id}`} className="text-cyan-300 hover:underline">{opp.project.code}</Link> : "—"}</DetailField>
          <DetailField label="Created">{formatDate(opp.createdAt)}</DetailField>
          <DetailField label="Notes">{opp.notes ?? "—"}</DetailField>
        </DetailGrid>
      </section>

      <section className="card p-6">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Pipeline stage guide</div>
        <ol className="mt-4 space-y-2 text-sm">
          {["LEAD", "QUALIFIED", "PROPOSAL", "BID", "AWARDED", "LOST", "WITHDRAWN"].map((stage) => (
            <li key={stage} className={`flex items-center justify-between rounded-lg border px-4 py-2 ${opp.stage === stage ? "border-cyan-500/40 bg-cyan-500/10 text-white" : "border-white/5 bg-white/[0.02] text-slate-400"}`}>
              <span className="font-medium">{stage.replaceAll("_", " ")}</span>
              {opp.stage === stage ? <StatusBadge status={stage} /> : <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">—</span>}
            </li>
          ))}
        </ol>
      </section>
    </DetailShell>
  );
}
