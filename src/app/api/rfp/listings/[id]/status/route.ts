import { NextRequest, NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { auth } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { RfpListingStatus } from "@prisma/client";

const VALID = Object.values(RfpListingStatus);

/**
 * Update an RfpListing.status. Tenant-scoped (only the listing's owning
 * tenant can change it). Records an audit event with before/after so
 * /settings/audit shows the trail. Form-encoded POST returns to the
 * detail page; JSON POST returns the updated row.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const tenant = await requireTenant();
  const form = await req.formData();
  const status = form.get("status") as string | null;
  if (!status || !VALID.includes(status as RfpListingStatus)) {
    return NextResponse.json({ error: `invalid status; expected one of ${VALID.join(", ")}` }, { status: 400 });
  }
  const before = await prisma.rfpListing.findFirst({ where: { id, tenantId: tenant.id }, select: { id: true, status: true } });
  if (!before) return NextResponse.json({ error: "listing not found" }, { status: 404 });
  if (before.status === status) {
    redirect(`/bids/listings/${id}`);
  }
  await prisma.rfpListing.update({ where: { id }, data: { status: status as RfpListingStatus } });
  const session = await auth();
  await recordAudit({
    tenantId: tenant.id,
    actorId: session?.userId ?? null,
    actorName: session?.user?.name ?? null,
    entityType: "RfpListing",
    entityId: id,
    action: "RFP_LISTING_STATUS_CHANGED",
    before: { status: before.status },
    after: { status },
    source: "bids/listings/[id]",
  });
  redirect(`/bids/listings/${id}`);
}
