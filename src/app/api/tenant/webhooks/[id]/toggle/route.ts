import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const tenant = await requireTenant();
  const { id } = await ctx.params;
  const w = await prisma.webhookEndpoint.findFirst({ where: { id, tenantId: tenant.id } });
  if (!w) redirect("/settings/api?error=webhook+not+found");
  await prisma.webhookEndpoint.update({ where: { id }, data: { active: !w!.active } });
  redirect("/settings/api?ok=Webhook+toggled");
}
