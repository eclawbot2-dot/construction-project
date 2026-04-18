import { AppLayout } from "@/components/layout/app-layout";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatTile } from "@/components/ui/stat-tile";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function VendorsPage() {
  const tenant = await requireTenant();
  const vendors = await prisma.vendor.findMany({
    where: { tenantId: tenant.id },
    include: { insuranceCerts: true, subBids: true, subInvoices: true },
    orderBy: { name: "asc" },
  });

  const approved = vendors.filter((v) => v.prequalStatus === "APPROVED").length;
  const expiring = vendors.filter((v) => v.prequalExpires && new Date(v.prequalExpires) < new Date(Date.now() + 60 * 24 * 3600 * 1000)).length;
  const insuranceLapsing = vendors.filter((v) => v.insuranceCerts.some((c) => new Date(c.expirationDate) < new Date(Date.now() + 30 * 24 * 3600 * 1000))).length;

  return (
    <AppLayout eyebrow="Subcontractor management" title="Vendors & prequalification" description="Sub & vendor registry with insurance, EMR, bonding capacity, and prequalification status.">
      <div className="grid gap-6">
        <section className="grid gap-4 md:grid-cols-4">
          <StatTile label="Registered vendors" value={vendors.length} />
          <StatTile label="Approved" value={approved} tone="good" />
          <StatTile label="Prequal expiring (60d)" value={expiring} tone={expiring > 0 ? "warn" : "good"} />
          <StatTile label="Insurance lapsing (30d)" value={insuranceLapsing} tone={insuranceLapsing > 0 ? "bad" : "good"} />
        </section>
        <section className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-white/5">
                <tr>
                  <th className="table-header">Vendor</th>
                  <th className="table-header">Trade</th>
                  <th className="table-header">Prequal</th>
                  <th className="table-header">Score</th>
                  <th className="table-header">EMR</th>
                  <th className="table-header">Bonding</th>
                  <th className="table-header">Expires</th>
                  <th className="table-header">Certs</th>
                  <th className="table-header">Activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-slate-950/40">
                {vendors.map((v) => (
                  <tr key={v.id}>
                    <td className="table-cell">
                      <div className="font-medium text-white">{v.name}</div>
                      <div className="text-xs text-slate-500">{v.legalName}</div>
                    </td>
                    <td className="table-cell">{v.trade ?? "—"}</td>
                    <td className="table-cell"><StatusBadge status={v.prequalStatus} /></td>
                    <td className="table-cell">{v.prequalScore ?? "—"}</td>
                    <td className="table-cell">{v.emrRate ? v.emrRate.toFixed(2) : "—"}</td>
                    <td className="table-cell">{formatCurrency(v.bondingCapacity)}</td>
                    <td className="table-cell text-slate-400">{formatDate(v.prequalExpires)}</td>
                    <td className="table-cell">
                      <div className="flex flex-wrap gap-1">
                        {v.insuranceCerts.map((c) => (
                          <span key={c.id} className="badge-gray text-[10px]">{c.type.replace("_", " ")}</span>
                        ))}
                      </div>
                    </td>
                    <td className="table-cell text-xs text-slate-400">
                      {v.subBids.length} bid{v.subBids.length === 1 ? "" : "s"} · {v.subInvoices.length} invoice{v.subInvoices.length === 1 ? "" : "s"}
                    </td>
                  </tr>
                ))}
                {vendors.length === 0 ? <tr><td colSpan={9} className="table-cell text-center text-slate-500">No vendors registered.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
