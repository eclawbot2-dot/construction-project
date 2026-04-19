import { notFound } from "next/navigation";
import Link from "next/link";
import { DetailShell, DetailGrid, DetailField } from "@/components/layout/detail-shell";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function BidDraftDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await requireTenant();
  const draft = await prisma.bidDraft.findFirst({
    where: { id, tenantId: tenant.id },
    include: {
      sections: { orderBy: { position: "asc" } },
      complianceRuns: { include: { items: true }, orderBy: { runAt: "desc" }, take: 5 },
      rfpListing: true,
      opportunity: true,
    },
  });
  if (!draft) notFound();

  const latestRun = draft.complianceRuns[0];
  const wordCount = draft.sections.reduce((s, sc) => s + sc.wordCount, 0);

  return (
    <DetailShell
      eyebrow="Bid draft"
      title={draft.title}
      subtitle={draft.rfpListing ? `Response to ${draft.rfpListing.agency} · ${draft.rfpListing.solicitationNo ?? ""}` : undefined}
      crumbs={[{ label: "Bid Hub", href: "/bids" }, { label: "RFPs", href: "/bids/listings" }, { label: draft.title }]}
      actions={<StatusBadge status={draft.status} />}
    >
      <section className="grid gap-4 md:grid-cols-4">
        <StatTile label="Proposed price" value={formatCurrency(draft.totalValue)} tone="good" />
        <StatTile label="Sections" value={draft.sections.length} />
        <StatTile label="Word count" value={wordCount.toLocaleString()} />
        <StatTile label="Compliance" value={latestRun ? latestRun.summary ?? latestRun.overall : "not run"} tone={latestRun?.overall === "PASS" ? "good" : latestRun?.overall === "FAIL" ? "bad" : "warn"} />
      </section>

      <section className="card p-6">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Proposal overview</div>
        <DetailGrid>
          <DetailField label="Title">{draft.title}</DetailField>
          <DetailField label="Model">{draft.modelUsed}</DetailField>
          <DetailField label="Author">{draft.authorName ?? "—"}</DetailField>
          <DetailField label="Submitted">{formatDate(draft.submittedAt)}</DetailField>
          <DetailField label="Updated">{formatDate(draft.updatedAt)}</DetailField>
          <DetailField label="Win themes">{draft.winThemes ?? "—"}</DetailField>
          <DetailField label="Key differentiators">{draft.keyDifferentiators ?? "—"}</DetailField>
          <DetailField label="Linked listing">{draft.rfpListing ? <Link href={`/bids/listings?status=${draft.rfpListing.status}`} className="text-cyan-300 hover:underline">{draft.rfpListing.title}</Link> : "—"}</DetailField>
          <DetailField label="Linked opportunity">{draft.opportunity ? <Link href={`/opportunities/${draft.opportunity.id}`} className="text-cyan-300 hover:underline">{draft.opportunity.name}</Link> : "—"}</DetailField>
        </DetailGrid>
        <div className="mt-4 flex flex-wrap gap-3">
          <form action={`/api/bid-drafts/${draft.id}/compliance`} method="post">
            <button className="btn-primary">Run compliance check</button>
          </form>
        </div>
      </section>

      {draft.sections.map((s) => (
        <section key={s.id} className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">{s.heading}</div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{s.wordCount} words</div>
            </div>
          </div>
          <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-200">{s.body}</p>
        </section>
      ))}

      {latestRun ? (
        <section className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Compliance check · {formatDate(latestRun.runAt)}</div>
              <div className="text-sm text-slate-300">{latestRun.summary}</div>
            </div>
            <StatusBadge status={latestRun.overall} />
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-white/5">
                <tr>
                  <th className="table-header">Category</th>
                  <th className="table-header">Requirement</th>
                  <th className="table-header">Outcome</th>
                  <th className="table-header">Evidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-slate-950/40">
                {latestRun.items.map((i) => (
                  <tr key={i.id}>
                    <td className="table-cell">{i.category}</td>
                    <td className="table-cell">{i.requirement}</td>
                    <td className="table-cell"><StatusBadge status={i.outcome} /></td>
                    <td className="table-cell text-xs text-slate-400">{i.evidence ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </DetailShell>
  );
}
