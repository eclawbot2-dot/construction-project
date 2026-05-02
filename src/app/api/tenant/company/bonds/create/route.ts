import { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";

export async function POST(req: NextRequest) {
  const tenant = await requireTenant();
  const form = await req.formData();
  const bondType = (form.get("bondType") as string | null)?.trim();
  const surety = (form.get("surety") as string | null)?.trim();
  if (!bondType || !surety) redirect("/settings/company?error=type+and+surety+required#bonds");
  const amountRaw = form.get("bondAmount") as string | null;
  const bondAmount = Number(amountRaw) || 0;
  const expiresRaw = form.get("expiresAt") as string | null;
  const expiresAt = expiresRaw ? new Date(expiresRaw) : null;

  await prisma.companyBond.create({
    data: { tenantId: tenant.id, bondType: bondType!, surety: surety!, bondAmount, expiresAt },
  });
  redirect("/settings/company?ok=Bond+saved#bonds");
}
