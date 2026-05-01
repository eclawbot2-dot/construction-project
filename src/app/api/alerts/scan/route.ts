import { runAlertScan } from "@/lib/alerts";
import { requireTenant } from "@/lib/tenant";
import { requireEditor } from "@/lib/permissions";
import { publicRedirect } from "@/lib/redirect";

export async function POST(req: Request) {
  const tenant = await requireTenant();
  await requireEditor(tenant.id);
  await runAlertScan(tenant.id);
  return publicRedirect(req, "/alerts", 303);
}
