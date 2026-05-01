import { NextResponse } from "next/server";
import { ingestSpreadsheet } from "@/lib/historical-import";
import { requireTenant } from "@/lib/tenant";
import { requireEditor } from "@/lib/permissions";
import { HistoricalImportKind } from "@prisma/client";
import { publicRedirect } from "@/lib/redirect";

const VALID_KINDS: HistoricalImportKind[] = ["PROJECT_ACTUALS", "BID_HISTORY", "INCOME_STATEMENT", "BUDGET_TEMPLATE", "SCHEDULE_OF_VALUES", "VENDOR_LIST"];

export async function POST(req: Request) {
  const tenant = await requireTenant();
  await requireEditor(tenant.id);
  const form = await req.formData();
  const file = form.get("file");
  const kindRaw = String(form.get("kind") ?? "PROJECT_ACTUALS");
  const label = String(form.get("label") ?? "Untitled import").trim() || "Untitled import";
  const projectId = String(form.get("projectId") ?? "") || null;
  const kind = VALID_KINDS.includes(kindRaw as HistoricalImportKind) ? (kindRaw as HistoricalImportKind) : "PROJECT_ACTUALS";

  if (!(file instanceof File)) return NextResponse.json({ error: "file is required (multipart/form-data)" }, { status: 400 });
  const csv = await file.text();
  const imp = await ingestSpreadsheet({
    tenantId: tenant.id,
    projectId,
    kind,
    label,
    filename: file.name,
    fileSize: file.size,
    csv,
  });
  return publicRedirect(req, `/imports/${imp.id}`, 303);
}
