import { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";

export async function POST(req: NextRequest) {
  const tenant = await requireTenant();
  const form = await req.formData();
  const code = (form.get("code") as string | null)?.trim();
  const name = (form.get("name") as string | null)?.trim();
  if (!code || !name) redirect("/settings/cost-codes?error=code+and+name+required");
  const csiDivision = (form.get("csiDivision") as string | null)?.trim() || null;
  await prisma.costCode.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: code! } },
    create: { tenantId: tenant.id, code: code!, name: name!, csiDivision },
    update: { name: name!, csiDivision },
  });
  redirect("/settings/cost-codes?ok=Cost+code+saved");
}
