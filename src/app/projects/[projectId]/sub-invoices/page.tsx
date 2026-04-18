import { notFound } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { ProjectTabs } from "@/components/layout/project-tabs";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatTile } from "@/components/ui/stat-tile";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function SubInvoicesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { subInvoices: { include: { vendor: true }, orderBy: { invoiceDate: "desc" } } },
  });
  if (!project) notFound();

  const totalGross = project.subInvoices.reduce((s, i) => s + i.amount, 0);
  const retainageHeld = project.subInvoices.reduce((s, i) => s + i.retainageHeld, 0);
  const netDue = project.subInvoices.filter((i) => i.status !== "PAID").reduce((s, i) => s + i.netDue, 0);

  return (
    <AppLayout eyebrow={`${project.code} · Sub invoices`} title={project.name} description="Subcontractor pay applications with retainage, compliance, and waiver tracking.">
      <div className="grid gap-6">
        <ProjectTabs projectId={project.id} active="sub-invoices" />
        <section className="grid gap-4 md:grid-cols-4">
          <StatTile label="Invoices on file" value={project.subInvoices.length} />
          <StatTile label="Gross billed" value={formatCurrency(totalGross)} />
          <StatTile label="Retainage held" value={formatCurrency(retainageHeld)} tone="warn" />
          <StatTile label="Net due" value={formatCurrency(netDue)} tone={netDue > 0 ? "warn" : "good"} />
        </section>
        <section className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-white/5">
                <tr>
                  <th className="table-header">Vendor</th>
                  <th className="table-header">Invoice #</th>
                  <th className="table-header">Amount</th>
                  <th className="table-header">Retainage</th>
                  <th className="table-header">Net due</th>
                  <th className="table-header">Invoiced</th>
                  <th className="table-header">Due</th>
                  <th className="table-header">Waiver</th>
                  <th className="table-header">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-slate-950/40">
                {project.subInvoices.map((i) => (
                  <tr key={i.id}>
                    <td className="table-cell">
                      <div className="font-medium text-white">{i.vendor.name}</div>
                      <div className="text-xs text-slate-500">{i.description}</div>
                    </td>
                    <td className="table-cell font-mono text-xs">{i.invoiceNumber}</td>
                    <td className="table-cell">{formatCurrency(i.amount)}</td>
                    <td className="table-cell">{formatCurrency(i.retainageHeld)}</td>
                    <td className="table-cell">{formatCurrency(i.netDue)}</td>
                    <td className="table-cell text-slate-400">{formatDate(i.invoiceDate)}</td>
                    <td className="table-cell text-slate-400">{formatDate(i.dueDate)}</td>
                    <td className="table-cell">{i.waiverReceived ? <StatusBadge tone="good" label="Received" /> : <StatusBadge tone="warn" label="Pending" />}</td>
                    <td className="table-cell"><StatusBadge status={i.status} /></td>
                  </tr>
                ))}
                {project.subInvoices.length === 0 ? <tr><td colSpan={9} className="table-cell text-center text-slate-500">No sub invoices.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
