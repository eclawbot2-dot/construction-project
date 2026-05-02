import { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";

export async function POST(req: NextRequest) {
  const tenant = await requireTenant();
  const form = await req.formData();
  const licenseType = (form.get("licenseType") as string | null)?.trim();
  const licenseNumber = (form.get("licenseNumber") as string | null)?.trim();
  if (!licenseType || !licenseNumber) redirect("/settings/company?error=type+and+number+required");
  const state = (form.get("state") as string | null)?.trim() || null;
  const expiresRaw = form.get("expiresAt") as string | null;
  const expiresAt = expiresRaw ? new Date(expiresRaw) : null;

  const existing = await prisma.companyLicense.findFirst({
    where: { tenantId: tenant.id, licenseNumber: licenseNumber!, state },
  });
  if (existing) {
    await prisma.companyLicense.update({
      where: { id: existing.id },
      data: { licenseType: licenseType!, expiresAt },
    });
  } else {
    await prisma.companyLicense.create({
      data: { tenantId: tenant.id, licenseType: licenseType!, licenseNumber: licenseNumber!, state, expiresAt },
    });
  }
  redirect("/settings/company?ok=License+saved#licenses");
}
