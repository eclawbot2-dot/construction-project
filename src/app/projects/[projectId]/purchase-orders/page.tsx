import Link from "next/link";
import { notFound } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { ProjectTabs } from "@/components/layout/project-tabs";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatTile } from "@/components/ui/stat-tile";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function PurchaseOrdersPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const tenant = await requireTenant();
  const project = await prisma.project.findFirst({
    where: { id: projectId, tenantId: tenant.id },
    include: { purchaseOrders: { include: { vendor: true }, orderBy: { issuedAt: "desc" } } },
  });
  if (!project) notFound();

  const total = project.purchaseOrders.reduce((s, p) => s + p.amount, 0);
  const invoiced = project.purchaseOrders.reduce((s, p) => s + p.invoicedToDate, 0);

  return (
    <AppLayout eyebrow={`${project.code} · Purchase orders`} title={project.name} description="Material POs with vendor, expected delivery, and invoice-to-date tracking.">
      <div className="grid gap-6">
        <ProjectTabs projectId={project.id} active="purchase-orders" mode={project.mode} />
        <section className="grid gap-4 md:grid-cols-3">
          <StatTile label="Open POs" value={project.purchaseOrders.length} />
          <StatTile label="Committed" value={formatCurrency(total)} />
          <StatTile label="Invoiced" value={formatCurrency(invoiced)} tone="good" />
        </section>
        <section className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-white/5">
                <tr>
                  <th className="table-header">PO #</th>
                  <th className="table-header">Vendor</th>
                  <th className="table-header">Description</th>
                  <th className="table-header">Amount</th>
                  <th className="table-header">Invoiced</th>
                  <th className="table-header">Remaining</th>
                  <th className="table-header">Expected</th>
                  <th className="table-header">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-slate-950/40">
                {project.purchaseOrders.map((p) => (
                  <tr key={p.id} className="cursor-pointer transition hover:bg-white/5">
                    <td className="table-cell font-mono text-xs"><Link href={`/projects/${project.id}/purchase-orders/${p.id}`} className="text-cyan-300 hover:text-cyan-200 hover:underline">{p.poNumber}</Link></td>
                    <td className="table-cell">{p.vendor.name}</td>
                    <td className="table-cell">{p.description}</td>
                    <td className="table-cell">{formatCurrency(p.amount)}</td>
                    <td className="table-cell">{formatCurrency(p.invoicedToDate)}</td>
                    <td className="table-cell">{formatCurrency(p.amount - p.invoicedToDate)}</td>
                    <td className="table-cell text-slate-400">{formatDate(p.expectedDelivery)}</td>
                    <td className="table-cell"><StatusBadge status={p.status} /></td>
                  </tr>
                ))}
                {project.purchaseOrders.length === 0 ? <tr><td colSpan={8} className="table-cell text-center text-slate-500">No purchase orders.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
