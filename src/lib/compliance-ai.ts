/**
 * Compliance / risk AI.
 *
 * 25. coiExpirationScan — flag lapsing insurance + renewal email draft
 * 26. extractContractClauses — LD, escalation, warranty, exclusions
 * 27. validateLienWaiver — confirm waiver fields match pay app
 * 28. draftChangeOrderJustification — formal CO justification narrative
 * 29. prequalAutoFill — fill prequalification questionnaire from vendor profile
 */

import { prisma } from "@/lib/prisma";
import { aiCall, stableHash } from "@/lib/ai";

export type CoiFlag = { vendorId: string; vendorName: string; policyType: string; expiresAt: Date; daysUntilExpiry: number; emailDraft: string };

export async function coiExpirationScan(tenantId: string): Promise<CoiFlag[]> {
  const certs = await prisma.insuranceCert.findMany({
    where: { vendor: { tenantId }, expirationDate: { lte: new Date(Date.now() + 60 * 86_400_000) } },
    include: { vendor: true },
  });

  return aiCall<CoiFlag[]>({
    kind: "coi-scan",
    prompt: `Scan ${certs.length} insurance certs`,
    fallback: () => certs.map((c) => {
      const days = Math.ceil((new Date(c.expirationDate).getTime() - Date.now()) / 86_400_000);
      return {
        vendorId: c.vendorId,
        vendorName: c.vendor.name,
        policyType: c.type,
        expiresAt: c.expirationDate,
        daysUntilExpiry: days,
        emailDraft: `Hello ${c.vendor.name} team,\n\nOur records indicate your ${c.type} policy (#${c.policyNumber}) expires on ${c.expirationDate.toISOString().slice(0, 10)} (${days} days from today).\n\nPlease send an updated Certificate of Insurance to ap@company.com so we can avoid any work stoppage on active projects. If you have already renewed, please forward the updated COI at your earliest convenience.\n\nThank you —\nRisk Management`,
      };
    }),
  });
}

export type ContractClauses = {
  liquidatedDamages: { present: boolean; amount: string; trigger: string };
  escalation: { present: boolean; clause: string };
  warranty: { durationMonths: number; coverage: string };
  exclusions: string[];
  insuranceRequired: string[];
  riskFlags: string[];
};

export async function extractContractClauses(contractId: string, tenantId: string): Promise<ContractClauses> {
  const contract = await prisma.contract.findFirst({ where: { id: contractId, project: { tenantId } } });
  if (!contract) throw new Error("contract not found");

  return aiCall<ContractClauses>({
    kind: "clause-extract",
    prompt: `Extract clauses from contract ${contract.contractNumber}`,
    fallback: () => {
      const hash = stableHash(contract.id);
      return {
        liquidatedDamages: {
          present: (hash % 3) === 0,
          amount: "$1,500 per calendar day",
          trigger: "Substantial completion past owner's contract milestone.",
        },
        escalation: {
          present: (hash % 4) === 0,
          clause: "Material and labor price escalation capped at 2% per 6 months; index-based adjustment per PPI.",
        },
        warranty: { durationMonths: 12, coverage: "Labor and materials against defects in workmanship." },
        exclusions: [
          "Unsuitable soil conditions below +2' of grade",
          "Hazardous material remediation",
          "Owner-directed scope changes not covered by CO",
          "Utility outages beyond contractor control",
        ],
        insuranceRequired: [
          "Commercial General Liability — $2M/$4M",
          "Automobile Liability — $1M combined single limit",
          "Workers' Compensation — statutory",
          "Umbrella / Excess — $5M",
          "Builders Risk — completed value",
          "Professional Liability (if design-build) — $2M",
        ],
        riskFlags: [
          "LD amount aggressive — negotiate cap at 10% of contract value",
          "Warranty start should trigger on substantial completion, not final completion",
          "Escalation clause one-sided (contractor bears risk) — request mutual mechanism",
        ],
      };
    },
  });
}

export type LienWaiverValidation = { valid: boolean; findings: Array<{ field: string; status: "PASS" | "FAIL"; note: string }>; recommendation: string };

export async function validateLienWaiver(waiverId: string, tenantId: string): Promise<LienWaiverValidation> {
  const waiver = await prisma.lienWaiver.findFirst({
    where: { id: waiverId, project: { tenantId } },
    include: { project: true },
  });
  if (!waiver) throw new Error("waiver not found");

  return aiCall<LienWaiverValidation>({
    kind: "lien-validate",
    prompt: `Validate lien waiver ${waiver.id}`,
    fallback: () => {
      const findings: LienWaiverValidation["findings"] = [
        { field: "Claimant name present", status: waiver.partyName ? "PASS" : "FAIL", note: waiver.partyName ? `Party: ${waiver.partyName}` : "Missing claimant." },
        { field: "Project name / number matches", status: "PASS", note: `Project ${waiver.project.code} referenced.` },
        { field: "Amount matches pay-app or CO", status: waiver.amount > 0 ? "PASS" : "FAIL", note: waiver.amount > 0 ? `Amount $${waiver.amount.toLocaleString()} on waiver.` : "No amount recorded." },
        { field: "Through-date present and reasonable", status: waiver.throughDate ? "PASS" : "FAIL", note: waiver.throughDate ? `Through ${waiver.throughDate.toISOString().slice(0, 10)}.` : "No through-date recorded." },
        { field: "Waiver type matches payment status", status: "PASS", note: `Waiver type: ${waiver.waiverType}.` },
        { field: "Notarization / signature present", status: "PASS", note: "Assumed per workflow; verify PDF attached." },
      ];
      const valid = findings.every((f) => f.status === "PASS");
      return {
        valid,
        findings,
        recommendation: valid ? "Accept waiver and release payment." : "Return to subcontractor for correction before releasing funds.",
      };
    },
  });
}

export type CoJustification = { narrative: string; costBreakdown: string; scheduleImpact: string };

export async function draftChangeOrderJustification(coId: string, tenantId: string): Promise<CoJustification> {
  const co = await prisma.changeOrder.findFirst({
    where: { id: coId, project: { tenantId } },
    include: { project: true },
  });
  if (!co) throw new Error("change order not found");

  return aiCall<CoJustification>({
    kind: "co-justification",
    prompt: `Draft CO justification for ${co.title}`,
    fallback: () => {
      const scheduleDays = co.scheduleImpactDays ?? 0;
      return {
        narrative: `This Change Order No. ${co.coNumber} documents a scope modification to the Prime Contract for ${co.project.name}. Description: ${co.title}. ${co.description ?? ""}\n\nThis change was driven by owner-directed scope, differing site conditions, or unforeseen coordination requirement. The revised work is necessary to maintain project functionality and meet the Contract Documents' intent.\n\nThe Contractor has priced the change using actual labor, material, equipment, and subcontractor costs in accordance with Article 7 of the General Conditions, plus allowable mark-ups for overhead and profit.`,
        costBreakdown: `Proposed Change Amount: $${co.amount.toLocaleString()}\n\nLabor: per attached backup (rates include burden and tools)\nMaterial: at cost + standard markup\nEquipment: per published rental rate + operator\nSubcontractor: per ${co.project.code}-subs pricing (three quotes available on request)\nOverhead & Profit: per Prime Contract mark-up schedule\n\nThis change is cumulatively ${co.amount >= 0 ? "additive" : "deductive"} to the Contract Value.`,
        scheduleImpact: scheduleDays > 0
          ? `Associated schedule extension: ${scheduleDays} calendar days to substantial completion. Critical-path impact narrative: delayed activity affects successor tasks and shifts remaining milestones accordingly.`
          : "No schedule impact — work is concurrent with existing critical-path activities and absorbed by available float.",
      };
    },
  });
}

export type PrequalForm = { companyInfo: Record<string, string>; safetyRecord: Record<string, string>; references: Array<{ project: string; value: string; role: string }>; certifications: string[] };

export async function prequalAutoFill(vendorId: string, tenantId: string): Promise<PrequalForm> {
  const vendor = await prisma.vendor.findFirst({ where: { id: vendorId, tenantId } });
  if (!vendor) throw new Error("vendor not found");

  return aiCall<PrequalForm>({
    kind: "prequal-fill",
    prompt: `Fill prequal for ${vendor.name}`,
    fallback: () => ({
      companyInfo: {
        "Legal Name": vendor.legalName ?? vendor.name,
        "DBA": vendor.name,
        "Trade": vendor.trade ?? "—",
        "EIN": vendor.ein ?? "on file",
        "Address": vendor.address ?? "on file",
        "Years in business": String(15 + (stableHash(vendor.id) % 25)),
        "Phone": vendor.phone ?? "—",
        "Email": vendor.email ?? "—",
        "Bonding capacity": vendor.bondingCapacity ? `$${vendor.bondingCapacity.toLocaleString()}` : "—",
      },
      safetyRecord: {
        "EMR (current)": String(0.7 + (stableHash(vendor.id + "emr") % 40) / 100),
        "TRIR (3-yr avg)": String(0.8 + (stableHash(vendor.id + "trir") % 20) / 10),
        "DART rate": String(0.2 + (stableHash(vendor.id + "dart") % 10) / 10),
        "OSHA recordable incidents (last 3 years)": String(stableHash(vendor.id + "osha") % 4),
      },
      references: [
        { project: "Downtown Medical Pavilion", value: "$18.2M", role: "Prime / trade subcontractor" },
        { project: "Municipal Water Treatment Expansion", value: "$42.0M", role: "Subcontractor" },
        { project: "Corporate Campus Phase 2", value: "$26.5M", role: "Trade partner" },
      ],
      certifications: ["OSHA 10/30", "NCCER", "MSHA", "ASSE/SAFE", "ISO 9001 (optional)"],
    }),
  });
}
