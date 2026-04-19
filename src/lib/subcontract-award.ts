/**
 * Award a SubBid → generate a Subcontract with commitment rows.
 */

import { prisma } from "@/lib/prisma";
import { ContractStatus, ContractType, SubBidStatus } from "@prisma/client";

export async function awardSubBid(subBidId: string, tenantId: string): Promise<{ ok: boolean; contractId?: string; note: string }> {
  const bid = await prisma.subBid.findUnique({
    where: { id: subBidId },
    include: { bidPackage: { include: { project: true } }, vendor: true },
  });
  if (!bid) return { ok: false, note: "bid not found" };
  if (bid.bidPackage.project.tenantId !== tenantId) return { ok: false, note: "cross-tenant" };
  if (!bid.bidAmount) return { ok: false, note: "bid has no amount" };

  // Mark losers NOT_SELECTED
  await prisma.subBid.updateMany({
    where: { bidPackageId: bid.bidPackageId, status: { in: [SubBidStatus.SUBMITTED, SubBidStatus.BIDDING, SubBidStatus.INVITED] } },
    data: { status: SubBidStatus.NOT_SELECTED },
  });
  await prisma.subBid.update({ where: { id: bid.id }, data: { status: SubBidStatus.SELECTED } });

  const contractNumber = `${bid.bidPackage.project.code}-SUB-${bid.bidPackage.trade.replace(/[^A-Z]/gi, "").slice(0, 4).toUpperCase()}-${bid.id.slice(-4).toUpperCase()}`;
  const contract = await prisma.contract.create({
    data: {
      projectId: bid.bidPackage.projectId,
      counterparty: bid.vendor.name,
      contractNumber,
      title: `${bid.vendor.name} — ${bid.bidPackage.name}`,
      type: ContractType.SUBCONTRACT,
      status: ContractStatus.EXECUTED,
      originalValue: bid.bidAmount,
      currentValue: bid.bidAmount,
      retainagePct: 10,
      executedAt: new Date(),
      notes: `Awarded from bid package ${bid.bidPackage.name}. Inclusions: ${bid.inclusions ?? "—"}. Exclusions: ${bid.exclusions ?? "—"}.`,
    },
  });
  await prisma.contractCommitment.create({
    data: {
      contractId: contract.id,
      costCode: bid.bidPackage.trade,
      description: `${bid.bidPackage.name} — scope per RFP`,
      committedAmount: bid.bidAmount,
    },
  });

  await prisma.bidPackage.update({
    where: { id: bid.bidPackageId },
    data: { status: "AWARDED" },
  });

  await prisma.auditEvent.create({
    data: {
      tenantId,
      entityType: "Contract",
      entityId: contract.id,
      action: "AWARDED_FROM_SUBBID",
      afterJson: JSON.stringify({ subBidId: bid.id, vendorId: bid.vendor.id, amount: bid.bidAmount }),
      source: "subcontract-award",
    },
  });

  return { ok: true, contractId: contract.id, note: `Awarded subcontract ${contractNumber}` };
}
