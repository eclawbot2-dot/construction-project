import { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";

export async function POST(req: NextRequest) {
  const tenant = await requireTenant();
  const form = await req.formData();
  const certificationType = (form.get("certificationType") as string | null)?.trim();
  const certifyingAgency = (form.get("certifyingAgency") as string | null)?.trim();
  if (!certificationType || !certifyingAgency) redirect("/settings/company?error=type+and+agency+required#certifications");
  const certificateNumber = (form.get("certificateNumber") as string | null)?.trim() || null;
  const expiresRaw = form.get("expiresAt") as string | null;
  const expiresAt = expiresRaw ? new Date(expiresRaw) : null;

  await prisma.companyCertification.upsert({
    where: { tenantId_certificationType_certifyingAgency: { tenantId: tenant.id, certificationType: certificationType!, certifyingAgency: certifyingAgency! } },
    create: { tenantId: tenant.id, certificationType: certificationType!, certifyingAgency: certifyingAgency!, certificateNumber, expiresAt },
    update: { certificateNumber, expiresAt },
  });
  redirect("/settings/company?ok=Cert+saved#certifications");
}
