import { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";

export async function POST(req: NextRequest) {
  const tenant = await requireTenant();
  const form = await req.formData();
  const legalName = (form.get("legalName") as string | null)?.trim();
  if (!legalName) redirect("/settings/company?error=legal+name+required");
  const dbaName = (form.get("dbaName") as string | null)?.trim() || null;
  const ein = (form.get("ein") as string | null)?.trim() || null;
  const duns = (form.get("duns") as string | null)?.trim() || null;
  const cageCode = (form.get("cageCode") as string | null)?.trim() || null;
  const uei = (form.get("uei") as string | null)?.trim() || null;

  await prisma.companyProfile.upsert({
    where: { tenantId: tenant.id },
    create: { tenantId: tenant.id, legalName: legalName!, dbaName, ein, duns, cageCode, uei },
    update: { legalName: legalName!, dbaName, ein, duns, cageCode, uei },
  });
  redirect("/settings/company?ok=Profile+saved");
}
