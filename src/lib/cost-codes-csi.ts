/**
 * CSI MasterFormat 2020 16-division top-level cost-code seed. Each
 * tenant can extend with sub-sections (03 30 00 — Cast-in-Place
 * Concrete, 03 35 00 — Concrete Finishing, etc.). The seed ships the
 * 16 traditional divisions plus the modern site/utility additions —
 * enough to make BudgetLine and PayApplicationLine cost-code aware
 * out of the box.
 *
 * Used by `seedDefaultCostCodes(tenantId)` to populate a fresh tenant
 * the first time anyone visits the cost-code admin page.
 */

import { prisma } from "@/lib/prisma";

export const CSI_MASTERFORMAT_TOP_LEVEL: Array<{ code: string; name: string; description?: string }> = [
  { code: "01", name: "General Requirements", description: "Project-wide requirements: insurance, bonds, supervision, mobilization." },
  { code: "02", name: "Existing Conditions", description: "Demolition, hazardous-materials remediation, site assessment." },
  { code: "03", name: "Concrete", description: "Formwork, reinforcing, cast-in-place, precast." },
  { code: "04", name: "Masonry", description: "Brick, CMU, stone, mortar." },
  { code: "05", name: "Metals", description: "Structural steel, miscellaneous metal, fabrication." },
  { code: "06", name: "Wood, Plastics, Composites", description: "Rough carpentry, finish carpentry, millwork." },
  { code: "07", name: "Thermal & Moisture Protection", description: "Insulation, roofing, waterproofing, sealants." },
  { code: "08", name: "Openings", description: "Doors, frames, windows, glazing, hardware." },
  { code: "09", name: "Finishes", description: "Drywall, flooring, ceilings, paint, tile." },
  { code: "10", name: "Specialties", description: "Toilet partitions, signage, lockers, fire extinguishers." },
  { code: "11", name: "Equipment", description: "Foodservice, athletic, audiovisual, lab equipment." },
  { code: "12", name: "Furnishings", description: "Casework, window treatments, seating, art." },
  { code: "13", name: "Special Construction", description: "Pre-engineered structures, pools, vaults." },
  { code: "14", name: "Conveying Equipment", description: "Elevators, escalators, hoists, lifts." },
  { code: "21", name: "Fire Suppression", description: "Sprinklers, standpipes, fire pumps." },
  { code: "22", name: "Plumbing", description: "Domestic water, sanitary waste, storm drainage." },
  { code: "23", name: "HVAC", description: "Heating, ventilation, air conditioning, controls." },
  { code: "26", name: "Electrical", description: "Service, distribution, branch wiring, lighting." },
  { code: "27", name: "Communications", description: "Voice/data, AV, telephony, structured cabling." },
  { code: "28", name: "Electronic Safety & Security", description: "Access control, intrusion detection, surveillance." },
  { code: "31", name: "Earthwork", description: "Excavation, fill, grading, shoring." },
  { code: "32", name: "Exterior Improvements", description: "Pavement, landscaping, site furnishings, fencing." },
  { code: "33", name: "Utilities", description: "Site water, sanitary, storm, gas, electric, telecom." },
  { code: "34", name: "Transportation", description: "Bridges, tunnels, rail, airfield." },
  { code: "35", name: "Waterway & Marine Construction", description: "Dredging, dams, marine structures." },
];

/**
 * Idempotent seed — creates any CSI division row that doesn't already
 * exist for the tenant. Doesn't touch existing custom rows. Returns
 * the count created.
 */
export async function seedDefaultCostCodes(tenantId: string): Promise<{ created: number }> {
  let created = 0;
  for (const div of CSI_MASTERFORMAT_TOP_LEVEL) {
    const existing = await prisma.costCode.findUnique({
      where: { tenantId_code: { tenantId, code: div.code } },
    });
    if (existing) continue;
    await prisma.costCode.create({
      data: {
        tenantId,
        code: div.code,
        name: div.name,
        description: div.description,
        csiDivision: div.code,
        level: 0,
      },
    });
    created += 1;
  }
  return { created };
}
