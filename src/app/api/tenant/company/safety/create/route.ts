import { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";

export async function POST(req: NextRequest) {
  const tenant = await requireTenant();
  const form = await req.formData();
  const reportingYear = Number(form.get("reportingYear"));
  if (!Number.isFinite(reportingYear) || reportingYear < 1990) {
    redirect("/settings/company?error=valid+year+required#safety");
  }
  const emrRate = num(form.get("emrRate"));
  const trirRate = num(form.get("trirRate"));
  const dartRate = num(form.get("dartRate"));
  const laborHours = num(form.get("laborHours"));

  await prisma.companySafetyMetric.upsert({
    where: { tenantId_reportingYear: { tenantId: tenant.id, reportingYear } },
    create: { tenantId: tenant.id, reportingYear, emrRate, trirRate, dartRate, laborHours },
    update: { emrRate, trirRate, dartRate, laborHours },
  });
  redirect("/settings/company?ok=Year+saved#safety");
}

function num(v: FormDataEntryValue | null): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
