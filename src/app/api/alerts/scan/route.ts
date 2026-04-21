import { runAlertScan } from "@/lib/alerts";
import { requireTenant } from "@/lib/tenant";
import { publicRedirect } from "@/lib/redirect";

export async function POST(req: Request) {
  const tenant = await requireTenant();
  const result = await runAlertScan(tenant.id);
  return publicRedirect(req, "/alerts", 303);
}
