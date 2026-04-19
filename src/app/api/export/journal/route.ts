import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { csvResponse, toCsv } from "@/lib/csv";

export async function GET(req: Request) {
  const tenant = await requireTenant();
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const rows = await prisma.journalEntryRow.findMany({
    where: {
      tenantId: tenant.id,
      ...(projectId ? { projectId } : {}),
    },
    include: { project: true },
    orderBy: { entryDate: "desc" },
    take: 5000,
  });
  const out = rows.map((r) => ({
    date: r.entryDate.toISOString().slice(0, 10),
    project: r.project?.code ?? "",
    account: r.accountName,
    accountCode: r.accountCode,
    entryType: r.entryType,
    amount: r.amount,
    vendor: r.vendorName ?? "",
    costCode: r.costCode ?? "",
    confidence: r.allocationConfidence ?? "",
    status: r.reconciliationStatus,
    source: r.source,
    memo: r.memo,
    reference: r.reference ?? "",
  }));
  return csvResponse(`journal-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(out));
}
