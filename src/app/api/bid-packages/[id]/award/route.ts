import { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { auth } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const tenant = await requireTenant();
  const { id } = await ctx.params;
  const pkg = await prisma.bidPackage.findFirst({
    where: { id, project: { tenantId: tenant.id } },
    include: { project: true },
  });
  if (!pkg) redirect("/?error=bid+package+not+found");
  const form = await req.formData();
  const scopeItemKey = form.get("scopeItemKey") as string;
  const subBidId = form.get("subBidId") as string;
  if (!scopeItemKey || !subBidId) redirect(`/projects/${pkg.projectId}/bids/${id}/leveling?error=missing+fields`);
  const session = await auth();

  await prisma.bidLevelingResult.upsert({
    where: { bidPackageId_scopeItemKey: { bidPackageId: id, scopeItemKey } },
    create: {
      bidPackageId: id,
      scopeItemKey,
      awardedToSubBidId: subBidId,
      decidedBy: session?.user?.name ?? null,
    },
    update: {
      awardedToSubBidId: subBidId,
      decidedAt: new Date(),
      decidedBy: session?.user?.name ?? null,
    },
  });

  await recordAudit({
    tenantId: tenant.id,
    actorId: session?.userId ?? null,
    actorName: session?.user?.name ?? null,
    entityType: "BidLevelingResult",
    entityId: `${id}:${scopeItemKey}`,
    action: "BID_SCOPE_AWARDED",
    after: { scopeItemKey, subBidId },
    source: "api/bid-packages/[id]/award",
  });

  redirect(`/projects/${pkg.projectId}/bids/${id}/leveling?ok=Award+recorded`);
}
