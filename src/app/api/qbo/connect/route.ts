import { connectQboDemo, disconnectQbo, syncFromQbo } from "@/lib/qbo-sync";
import { requireTenant } from "@/lib/tenant";
import { requireManager } from "@/lib/permissions";
import { publicRedirect } from "@/lib/redirect";

export async function POST(req: Request) {
  const tenant = await requireTenant();
  await requireManager(tenant.id);
  const form = await req.formData();
  const action = String(form.get("action") ?? "connect");
  if (action === "disconnect") {
    await disconnectQbo(tenant.id);
  } else if (action === "sync") {
    await syncFromQbo(tenant.id);
  } else {
    await connectQboDemo(tenant.id);
  }
  const redirect = String(form.get("redirect") ?? "/finance");
  return publicRedirect(req, redirect, 303);
}
