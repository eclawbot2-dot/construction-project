import Link from "next/link";
import { notFound } from "next/navigation";
import { DetailShell, DetailGrid, DetailField } from "@/components/layout/detail-shell";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { formatCurrency, formatDate } from "@/lib/utils";
import { sumMoney } from "@/lib/money";

export default async function VendorDetailPage({ params }: { params: Promise<{ vendorId: string }> }) {
  const { vendorId } = await params;
  const tenant = await requireTenant();
  const vendor = await prisma.vendor.findFirst({
    where: { id: vendorId, tenantId: tenant.id },
    include: {
      insuranceCerts: { orderBy: { expirationDate: "asc" } },
      subBids: { include: { bidPackage: { include: { project: true } } }, orderBy: { createdAt: "desc" } },
      subInvoices: { include: { project: true }, orderBy: { invoiceDate: "desc" } },
      purchaseOrders: { include: { project: true }, orderBy: { issuedAt: "desc" } },
    },
  });
  if (!vendor) notFound();

  const activeCerts = vendor.insuranceCerts.filter((c) => new Date(c.expirationDate) >= new Date());
  const expiringSoon = vendor.insuranceCerts.filter((c) => {
    const d = new Date(c.expirationDate).getTime() - Date.now();
    return d >= 0 && d < 60 * 24 * 3600 * 1000;
  });
  const invoicedTotal = sumMoney(vendor.subInvoices.map((i) => i.amount));
  const paidTotal = sumMoney(vendor.subInvoices.filter((i) => i.status === "PAID").map((i) => i.amount));
  const outstanding = sumMoney(vendor.subInvoices.filter((i) => i.status !== "PAID").map((i) => i.netDue));
  const bidWinRate = (() => {
    if (vendor.subBids.length === 0) return "—";
    const selected = vendor.subBids.filter((b) => b.status === "SELECTED").length;
    return `${Math.round((selected / vendor.subBids.length) * 100)}%`;
  })();

  return (
    <DetailShell
      eyebrow="Vendor"
      title={vendor.name}
      subtitle={`${vendor.trade ?? "—"} · ${vendor.legalName ?? vendor.name}`}
      crumbs={[{ label: "Vendors", href: "/vendors" }, { label: vendor.name }]}
      actions={<div className="flex items-center gap-2"><StatusBadge status={vendor.prequalStatus} /><Link href={`/risk/prequal?vendorId=${vendor.id}`} className="btn-outline text-xs">AI · Prequal fill</Link></div>}
    >
      <section className="grid gap-4 md:grid-cols-4">
        <StatTile label="Prequal score" value={vendor.prequalScore ?? "—"} sub={vendor.prequalExpires ? `expires ${formatDate(vendor.prequalExpires)}` : undefined} tone={(vendor.prequalScore ?? 0) >= 85 ? "good" : (vendor.prequalScore ?? 0) >= 70 ? "warn" : "bad"} />
        <StatTile label="Active insurance" value={activeCerts.length} sub={expiringSoon.length > 0 ? `${expiringSoon.length} expiring <60d` : undefined} tone={expiringSoon.length > 0 ? "warn" : "good"} />
        <StatTile label="EMR" value={vendor.emrRate?.toFixed(2) ?? "—"} tone={(vendor.emrRate ?? 1) <= 1 ? "good" : (vendor.emrRate ?? 1) <= 1.1 ? "warn" : "bad"} />
        <StatTile label="Bid win rate" value={bidWinRate} sub={`${vendor.subBids.length} bids`} />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <StatTile label="Invoiced lifetime" value={formatCurrency(invoicedTotal)} />
        <StatTile label="Paid lifetime" value={formatCurrency(paidTotal)} tone="good" />
        <StatTile label="Outstanding" value={formatCurrency(outstanding)} tone={outstanding > 0 ? "warn" : "good"} />
      </section>

      <section className="card p-6">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Vendor profile</div>
        <DetailGrid>
          <DetailField label="Name">{vendor.name}</DetailField>
          <DetailField label="Legal name">{vendor.legalName ?? "—"}</DetailField>
          <DetailField label="Trade">{vendor.trade ?? "—"}</DetailField>
          <DetailField label="Email">{vendor.email ?? "—"}</DetailField>
          <DetailField label="Phone">{vendor.phone ?? "—"}</DetailField>
          <DetailField label="Address">{vendor.address ?? "—"}</DetailField>
          <DetailField label="EIN">{vendor.ein ?? "—"}</DetailField>
          <DetailField label="Bonding capacity">{formatCurrency(vendor.bondingCapacity)}</DetailField>
          <DetailField label="EMR rate">{vendor.emrRate?.toFixed(2) ?? "—"}</DetailField>
        </DetailGrid>
      </section>

      <section className="card p-0 overflow-hidden">
        <div className="px-5 py-3 text-xs uppercase tracking-[0.2em] text-slate-400">Insurance certificates</div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10">
            <thead className="bg-white/5">
              <tr>
                <th className="table-header">Type</th>
                <th className="table-header">Carrier</th>
                <th className="table-header">Policy #</th>
                <th className="table-header">Limits</th>
                <th className="table-header">Effective</th>
                <th className="table-header">Expires</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 bg-slate-950/40">
              {vendor.insuranceCerts.map((c) => {
                const expiring = new Date(c.expirationDate).getTime() - Date.now() < 60 * 24 * 3600 * 1000;
                const expired = new Date(c.expirationDate) < new Date();
                return (
                  <tr key={c.id}>
                    <td className="table-cell">{c.type.replaceAll("_", " ")}</td>
                    <td className="table-cell text-slate-400">{c.carrier}</td>
                    <td className="table-cell font-mono text-xs">{c.policyNumber}</td>
                    <td className="table-cell">{formatCurrency(c.limitEach)} / {formatCurrency(c.limitAggregate)}</td>
                    <td className="table-cell text-slate-400">{formatDate(c.effectiveDate)}</td>
                    <td className="table-cell">
                      <span className={expired ? "text-rose-300" : expiring ? "text-amber-300" : "text-slate-400"}>
                        {formatDate(c.expirationDate)}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {vendor.insuranceCerts.length === 0 ? <tr><td colSpan={6} className="table-cell text-center text-slate-500">No certificates on file.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card p-0 overflow-hidden">
        <div className="px-5 py-3 text-xs uppercase tracking-[0.2em] text-slate-400">Bid history</div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10">
            <thead className="bg-white/5">
              <tr>
                <th className="table-header">Project</th>
                <th className="table-header">Package</th>
                <th className="table-header">Amount</th>
                <th className="table-header">Days</th>
                <th className="table-header">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 bg-slate-950/40">
              {vendor.subBids.map((b) => (
                <tr key={b.id} className="transition hover:bg-white/5">
                  <td className="table-cell"><Link href={`/projects/${b.bidPackage.project.id}/bids`} className="text-cyan-300 hover:underline">{b.bidPackage.project.code}</Link></td>
                  <td className="table-cell">{b.bidPackage.name}</td>
                  <td className="table-cell">{formatCurrency(b.bidAmount)}</td>
                  <td className="table-cell text-slate-400">{b.daysToComplete ? `${b.daysToComplete}d` : "—"}</td>
                  <td className="table-cell"><StatusBadge status={b.status} /></td>
                </tr>
              ))}
              {vendor.subBids.length === 0 ? <tr><td colSpan={5} className="table-cell text-center text-slate-500">No bid history.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card p-0 overflow-hidden">
        <div className="px-5 py-3 text-xs uppercase tracking-[0.2em] text-slate-400">Invoices</div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10">
            <thead className="bg-white/5">
              <tr>
                <th className="table-header">Project</th>
                <th className="table-header">Invoice #</th>
                <th className="table-header">Amount</th>
                <th className="table-header">Net due</th>
                <th className="table-header">Invoiced</th>
                <th className="table-header">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 bg-slate-950/40">
              {vendor.subInvoices.map((i) => (
                <tr key={i.id} className="transition hover:bg-white/5">
                  <td className="table-cell"><Link href={`/projects/${i.project.id}/sub-invoices`} className="text-cyan-300 hover:underline">{i.project.code}</Link></td>
                  <td className="table-cell font-mono text-xs">{i.invoiceNumber}</td>
                  <td className="table-cell">{formatCurrency(i.amount)}</td>
                  <td className="table-cell">{formatCurrency(i.netDue)}</td>
                  <td className="table-cell text-slate-400">{formatDate(i.invoiceDate)}</td>
                  <td className="table-cell"><StatusBadge status={i.status} /></td>
                </tr>
              ))}
              {vendor.subInvoices.length === 0 ? <tr><td colSpan={6} className="table-cell text-center text-slate-500">No invoices.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card p-0 overflow-hidden">
        <div className="px-5 py-3 text-xs uppercase tracking-[0.2em] text-slate-400">Purchase orders</div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10">
            <thead className="bg-white/5">
              <tr>
                <th className="table-header">Project</th>
                <th className="table-header">PO #</th>
                <th className="table-header">Description</th>
                <th className="table-header">Amount</th>
                <th className="table-header">Invoiced</th>
                <th className="table-header">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 bg-slate-950/40">
              {vendor.purchaseOrders.map((p) => (
                <tr key={p.id} className="transition hover:bg-white/5">
                  <td className="table-cell"><Link href={`/projects/${p.project.id}/purchase-orders`} className="text-cyan-300 hover:underline">{p.project.code}</Link></td>
                  <td className="table-cell font-mono text-xs">{p.poNumber}</td>
                  <td className="table-cell">{p.description}</td>
                  <td className="table-cell">{formatCurrency(p.amount)}</td>
                  <td className="table-cell">{formatCurrency(p.invoicedToDate)}</td>
                  <td className="table-cell"><StatusBadge status={p.status} /></td>
                </tr>
              ))}
              {vendor.purchaseOrders.length === 0 ? <tr><td colSpan={6} className="table-cell text-center text-slate-500">No POs.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </DetailShell>
  );
}
