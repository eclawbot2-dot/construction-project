import { notFound } from "next/navigation";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { formatCurrency } from "@/lib/utils";
import { toNum } from "@/lib/money";

/**
 * Bid leveling matrix — one row per scope item, one column per bidder.
 * Cells show the bidder's amount + inclusion/exclusion flag. The
 * lowest non-excluded amount per row is highlighted; the GC can
 * record awards via the form.
 */
export default async function BidLevelingPage({ params }: { params: Promise<{ projectId: string; packageId: string }> }) {
  const { projectId, packageId } = await params;
  const tenant = await requireTenant();
  const project = await prisma.project.findFirst({ where: { id: projectId, tenantId: tenant.id } });
  if (!project) notFound();

  const pkg = await prisma.bidPackage.findFirst({
    where: { id: packageId, projectId },
    include: {
      subBids: {
        include: {
          vendor: true,
          lines: { orderBy: { scopeItemKey: "asc" } },
        },
      },
      levelingResults: true,
    },
  });
  if (!pkg) notFound();

  // Build matrix: scopeItemKey → { description, bids: { vendorId → line } }
  const scopeMap = new Map<string, { description: string; bids: Map<string, typeof pkg.subBids[number]["lines"][number]> }>();
  for (const sb of pkg.subBids) {
    for (const line of sb.lines) {
      const slot = scopeMap.get(line.scopeItemKey) ?? { description: line.description, bids: new Map() };
      slot.bids.set(sb.vendorId, line);
      if (!slot.description && line.description) slot.description = line.description;
      scopeMap.set(line.scopeItemKey, slot);
    }
  }
  const scopeRows = Array.from(scopeMap.entries()).sort(([a], [b]) => a.localeCompare(b));
  const awardMap = new Map(pkg.levelingResults.map((r) => [r.scopeItemKey, r]));

  return (
    <AppLayout
      eyebrow={`${project.name} · Bid leveling`}
      title={pkg.name}
      description={`${pkg.trade} · ${pkg.subBids.length} bidder${pkg.subBids.length === 1 ? "" : "s"}. Lowest non-excluded amount highlighted per row.`}
    >
      <div className="grid gap-6">
        <section className="card p-0 overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10 text-sm">
            <thead className="bg-white/5">
              <tr>
                <th className="table-header sticky left-0 bg-slate-950/80">Scope item</th>
                {pkg.subBids.map((sb) => (
                  <th key={sb.id} className="table-header text-right">
                    <div className="text-white">{sb.vendor.name}</div>
                    <div className="text-[10px] text-slate-500">{formatCurrency(sb.bidAmount ?? 0)} total</div>
                  </th>
                ))}
                <th className="table-header">Awarded</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {scopeRows.map(([key, row]) => {
                // Find lowest non-excluded amount
                let minAmount = Infinity;
                let minVendorId: string | null = null;
                for (const [vid, line] of row.bids) {
                  if (line.inclusion && toNum(line.amount) < minAmount) {
                    minAmount = toNum(line.amount);
                    minVendorId = vid;
                  }
                }
                const award = awardMap.get(key);
                return (
                  <tr key={key} className="hover:bg-white/5">
                    <td className="table-cell sticky left-0 bg-slate-950/80">
                      <div className="font-mono text-xs text-cyan-200">{key}</div>
                      <div className="text-xs text-slate-400">{row.description}</div>
                    </td>
                    {pkg.subBids.map((sb) => {
                      const line = row.bids.get(sb.vendorId);
                      if (!line) return <td key={sb.id} className="table-cell text-right text-slate-600">—</td>;
                      const isLow = sb.vendorId === minVendorId;
                      return (
                        <td key={sb.id} className={`table-cell text-right ${isLow ? "bg-emerald-500/10 text-emerald-200" : ""}`}>
                          {!line.inclusion ? <span className="text-rose-300 text-xs">EXCL</span> : null}
                          <div>{formatCurrency(line.amount)}</div>
                          {line.notes ? <div className="text-[10px] text-slate-500">{line.notes}</div> : null}
                        </td>
                      );
                    })}
                    <td className="table-cell">
                      {award ? (
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
                          {pkg.subBids.find((sb) => sb.id === award.awardedToSubBidId)?.vendor.name ?? "—"}
                        </span>
                      ) : (
                        <form action={`/api/bid-packages/${pkg.id}/award`} method="post" className="flex gap-1">
                          <input type="hidden" name="scopeItemKey" value={key} />
                          <select name="subBidId" className="form-select text-xs">
                            {pkg.subBids.map((sb) => <option key={sb.id} value={sb.id}>{sb.vendor.name}</option>)}
                          </select>
                          <button className="btn-outline text-xs">Award</button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
              {scopeRows.length === 0 ? <tr><td colSpan={pkg.subBids.length + 2} className="py-6 text-center text-slate-500">No line-item bids yet — sub bids are still summary-only.</td></tr> : null}
            </tbody>
          </table>
        </section>

        <section className="card p-5">
          <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Bidder summary</div>
          <ul className="mt-3 space-y-2">
            {pkg.subBids.map((sb) => (
              <li key={sb.id} className="panel p-3 flex items-center justify-between">
                <div>
                  <div className="text-sm text-white">{sb.vendor.name}</div>
                  <div className="text-xs text-slate-500">{sb.status} · {sb.lines.length} line{sb.lines.length === 1 ? "" : "s"}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-white">{formatCurrency(sb.bidAmount ?? 0)}</div>
                  {sb.daysToComplete ? <div className="text-xs text-slate-500">{sb.daysToComplete} days</div> : null}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <Link href={`/projects/${projectId}/bids`} className="btn-outline text-xs self-start">← Back to bid packages</Link>
      </div>
    </AppLayout>
  );
}
