import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/tenant";
import { seedDefaultCostCodes } from "@/lib/cost-codes-csi";

export async function POST() {
  const tenant = await requireTenant();
  const { created } = await seedDefaultCostCodes(tenant.id);
  redirect(`/settings/cost-codes?ok=${encodeURIComponent(`Seeded ${created} new CSI divisions`)}`);
}
