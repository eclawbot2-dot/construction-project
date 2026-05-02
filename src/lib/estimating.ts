/**
 * Estimate generation for a bid draft.
 *
 * Given an RFP listing (or opportunity) + company context, build a line-item
 * estimate with assemblies per trade, quantities, unit costs, and markup.
 * Stored on BidDraftLineItem rows so the number backing `totalValue` is
 * inspectable and editable.
 */

import { prisma } from "@/lib/prisma";
import type { BidDraft, RfpListing } from "@prisma/client";
import { sumMoney, multiplyMoney, addMoney, percentOf } from "@/lib/money";

type Assembly = {
  costCode: string;
  description: string;
  category: "LABOR" | "MATERIAL" | "EQUIPMENT" | "SUB" | "OTHER";
  qtyPerUnit: number;
  unit: string;
  unitLabor: number;
  unitMaterial: number;
  unitEquipment: number;
  unitSub: number;
};

const ASSEMBLIES_BY_NAICS: Record<string, Assembly[]> = {
  "236220": [
    { costCode: "031000", description: "Formwork", category: "LABOR", qtyPerUnit: 100, unit: "SFCA", unitLabor: 4.25, unitMaterial: 2.2, unitEquipment: 0.35, unitSub: 0 },
    { costCode: "033000", description: "Cast-in-place concrete", category: "MATERIAL", qtyPerUnit: 50, unit: "CY", unitLabor: 45, unitMaterial: 172, unitEquipment: 12, unitSub: 0 },
    { costCode: "051200", description: "Structural steel", category: "MATERIAL", qtyPerUnit: 25, unit: "TON", unitLabor: 1200, unitMaterial: 2400, unitEquipment: 180, unitSub: 0 },
    { costCode: "084113", description: "Storefront system", category: "SUB", qtyPerUnit: 40, unit: "LF", unitLabor: 0, unitMaterial: 0, unitEquipment: 0, unitSub: 420 },
    { costCode: "092900", description: "GWB and finishes", category: "SUB", qtyPerUnit: 200, unit: "SF", unitLabor: 0, unitMaterial: 0, unitEquipment: 0, unitSub: 4.85 },
    { costCode: "230500", description: "HVAC rough + VAV", category: "SUB", qtyPerUnit: 150, unit: "SF", unitLabor: 0, unitMaterial: 0, unitEquipment: 0, unitSub: 28 },
    { costCode: "260500", description: "Electrical rough + finish", category: "SUB", qtyPerUnit: 150, unit: "SF", unitLabor: 0, unitMaterial: 0, unitEquipment: 0, unitSub: 18 },
  ],
  "237110": [
    { costCode: "312213", description: "Trench excavation", category: "EQUIPMENT", qtyPerUnit: 800, unit: "LF", unitLabor: 6.5, unitMaterial: 2.1, unitEquipment: 9.4, unitSub: 0 },
    { costCode: "331111", description: "12in DIP water main", category: "MATERIAL", qtyPerUnit: 800, unit: "LF", unitLabor: 14, unitMaterial: 64, unitEquipment: 6.2, unitSub: 0 },
    { costCode: "312316", description: "Bedding + backfill", category: "MATERIAL", qtyPerUnit: 200, unit: "CY", unitLabor: 8, unitMaterial: 22, unitEquipment: 11, unitSub: 0 },
    { costCode: "329200", description: "Surface restoration (asphalt)", category: "SUB", qtyPerUnit: 4000, unit: "SY", unitLabor: 0, unitMaterial: 0, unitEquipment: 0, unitSub: 14 },
    { costCode: "015500", description: "Traffic control", category: "SUB", qtyPerUnit: 1, unit: "LS", unitLabor: 0, unitMaterial: 0, unitEquipment: 0, unitSub: 48000 },
  ],
  "237310": [
    { costCode: "321216", description: "Asphalt overlay", category: "SUB", qtyPerUnit: 12000, unit: "TON", unitLabor: 0, unitMaterial: 0, unitEquipment: 0, unitSub: 128 },
    { costCode: "312316", description: "Milling + grading", category: "EQUIPMENT", qtyPerUnit: 50000, unit: "SY", unitLabor: 0.6, unitMaterial: 0, unitEquipment: 1.4, unitSub: 0 },
    { costCode: "321313", description: "Concrete curb + gutter", category: "MATERIAL", qtyPerUnit: 4000, unit: "LF", unitLabor: 9, unitMaterial: 14, unitEquipment: 1.2, unitSub: 0 },
    { costCode: "321723", description: "Pavement markings", category: "SUB", qtyPerUnit: 1, unit: "LS", unitLabor: 0, unitMaterial: 0, unitEquipment: 0, unitSub: 62000 },
    { costCode: "015500", description: "Traffic control", category: "SUB", qtyPerUnit: 1, unit: "LS", unitLabor: 0, unitMaterial: 0, unitEquipment: 0, unitSub: 86000 },
  ],
  "default": [
    { costCode: "015000", description: "General conditions", category: "LABOR", qtyPerUnit: 1, unit: "LS", unitLabor: 45000, unitMaterial: 8000, unitEquipment: 4000, unitSub: 0 },
    { costCode: "033000", description: "Concrete work", category: "MATERIAL", qtyPerUnit: 40, unit: "CY", unitLabor: 45, unitMaterial: 172, unitEquipment: 12, unitSub: 0 },
    { costCode: "092900", description: "Drywall + finish", category: "SUB", qtyPerUnit: 200, unit: "SF", unitLabor: 0, unitMaterial: 0, unitEquipment: 0, unitSub: 4.85 },
    { costCode: "230000", description: "Mechanical", category: "SUB", qtyPerUnit: 1, unit: "LS", unitLabor: 0, unitMaterial: 0, unitEquipment: 0, unitSub: 160000 },
    { costCode: "260000", description: "Electrical", category: "SUB", qtyPerUnit: 1, unit: "LS", unitLabor: 0, unitMaterial: 0, unitEquipment: 0, unitSub: 120000 },
  ],
};

export async function generateEstimateForDraft(draftId: string): Promise<{ ok: boolean; lineItems: number; total: number }> {
  const draft = await prisma.bidDraft.findUnique({
    where: { id: draftId },
    include: { rfpListing: true },
  });
  if (!draft) return { ok: false, lineItems: 0, total: 0 };

  await prisma.bidDraftLineItem.deleteMany({ where: { draftId } });

  const assemblies = ASSEMBLIES_BY_NAICS[draft.rfpListing?.naicsCode ?? ""] ?? ASSEMBLIES_BY_NAICS.default;
  let pos = 0;
  let raw = 0;
  for (const a of assemblies) {
    // sumMoney + multiplyMoney avoid IEEE-754 drift across hundreds
    // of line items at penny precision.
    const direct = sumMoney([a.unitLabor, a.unitMaterial, a.unitEquipment, a.unitSub]);
    const amount = multiplyMoney(direct, a.qtyPerUnit);
    raw = addMoney(raw, amount);
    await prisma.bidDraftLineItem.create({
      data: {
        draftId,
        position: pos,
        costCode: a.costCode,
        description: a.description,
        category: a.category,
        quantity: a.qtyPerUnit,
        unit: a.unit,
        unitCost: direct,
        laborCost: multiplyMoney(a.unitLabor, a.qtyPerUnit),
        materialCost: multiplyMoney(a.unitMaterial, a.qtyPerUnit),
        equipmentCost: multiplyMoney(a.unitEquipment, a.qtyPerUnit),
        subCost: multiplyMoney(a.unitSub, a.qtyPerUnit),
        amount,
      },
    });
    pos += 1;
  }

  const overheadAmt = percentOf(raw, draft.overheadPct);
  const withOverhead = addMoney(raw, overheadAmt);
  const profitAmt = percentOf(withOverhead, draft.profitPct);
  const withProfit = addMoney(withOverhead, profitAmt);
  const totalCents = Math.round(withProfit);
  await prisma.bidDraft.update({ where: { id: draftId }, data: { totalValue: totalCents } });
  return { ok: true, lineItems: pos, total: totalCents };
}

void (null as unknown as BidDraft);
void (null as unknown as RfpListing);
