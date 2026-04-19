import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { csvResponse, toCsv } from "@/lib/csv";

export async function GET() {
  const tenant = await requireTenant();
  const rows = await prisma.subInvoice.findMany({
    where: { project: { tenantId: tenant.id }, status: { notIn: ["PAID", "REJECTED"] } },
    include: { vendor: true, project: true },
    orderBy: [{ dueDate: "asc" }],
  });
  const today = Date.now();
  const out = rows.map((i) => {
    const due = i.dueDate ?? i.invoiceDate;
    const daysPast = Math.floor((today - new Date(due).getTime()) / (1000 * 60 * 60 * 24));
    return {
      project: i.project.code,
      vendor: i.vendor.name,
      invoiceNumber: i.invoiceNumber,
      invoiceDate: i.invoiceDate.toISOString().slice(0, 10),
      dueDate: i.dueDate ? i.dueDate.toISOString().slice(0, 10) : "",
      daysPastDue: daysPast,
      amount: i.amount,
      retainageHeld: i.retainageHeld,
      netDue: i.netDue,
      waiverReceived: i.waiverReceived,
      status: i.status,
    };
  });
  return csvResponse(`ap-aging-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(out));
}
