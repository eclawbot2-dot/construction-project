import { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";

export async function POST(req: NextRequest) {
  const tenant = await requireTenant();
  const form = await req.formData();
  const name = (form.get("name") as string | null)?.trim();
  if (!name) redirect("/admin/capital-programs?error=name+required");
  const ownerName = (form.get("ownerName") as string | null)?.trim() || null;
  const totalBudget = Number(form.get("totalBudget")) || null;
  await prisma.capitalProgram.create({
    data: {
      tenantId: tenant.id,
      name: name!,
      ownerName,
      totalBudget,
    },
  });
  redirect("/admin/capital-programs?ok=Program+created");
}
