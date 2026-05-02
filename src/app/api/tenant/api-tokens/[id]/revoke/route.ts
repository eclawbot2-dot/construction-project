import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const tenant = await requireTenant();
  const { id } = await ctx.params;
  await prisma.apiToken.updateMany({
    where: { id, tenantId: tenant.id },
    data: { revokedAt: new Date() },
  });
  redirect("/settings/api?ok=Token+revoked");
}
