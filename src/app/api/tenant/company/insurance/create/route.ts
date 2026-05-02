import { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";

export async function POST(req: NextRequest) {
  const tenant = await requireTenant();
  const form = await req.formData();
  const policyType = (form.get("policyType") as string | null)?.trim();
  const carrier = (form.get("carrier") as string | null)?.trim();
  const policyNumber = (form.get("policyNumber") as string | null)?.trim();
  const effectiveRaw = form.get("effectiveDate") as string | null;
  const expiresRaw = form.get("expiresAt") as string | null;
  if (!policyType || !carrier || !policyNumber || !effectiveRaw || !expiresRaw) {
    redirect("/settings/company?error=missing+required+fields#insurance");
  }
  await prisma.companyInsurance.upsert({
    where: { tenantId_policyNumber: { tenantId: tenant.id, policyNumber: policyNumber! } },
    create: {
      tenantId: tenant.id,
      policyType: policyType!,
      carrier: carrier!,
      policyNumber: policyNumber!,
      effectiveDate: new Date(effectiveRaw!),
      expiresAt: new Date(expiresRaw!),
    },
    update: {
      policyType: policyType!,
      carrier: carrier!,
      effectiveDate: new Date(effectiveRaw!),
      expiresAt: new Date(expiresRaw!),
    },
  });
  redirect("/settings/company?ok=Insurance+saved#insurance");
}
