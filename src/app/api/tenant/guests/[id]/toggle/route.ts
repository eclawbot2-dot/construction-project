import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const tenant = await requireTenant();
  const { id } = await ctx.params;
  const g = await prisma.guestAccount.findFirst({ where: { id, tenantId: tenant.id } });
  if (!g) redirect("/settings/guests?error=not+found");
  await prisma.guestAccount.update({ where: { id }, data: { active: !g!.active } });
  redirect("/settings/guests?ok=Guest+toggled");
}
