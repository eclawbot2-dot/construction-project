import { NextResponse } from "next/server";
import { connectXeroDemo, disconnectXero, syncFromXero } from "@/lib/xero-sync";
import { requireTenant } from "@/lib/tenant";

export async function POST(req: Request) {
  const tenant = await requireTenant();
  const form = await req.formData();
  const action = String(form.get("action") ?? "connect");
  if (action === "disconnect") {
    await disconnectXero(tenant.id);
  } else if (action === "sync") {
    await syncFromXero(tenant.id);
  } else {
    await connectXeroDemo(tenant.id);
  }
  const redirect = String(form.get("redirect") ?? "/finance");
  return NextResponse.redirect(new URL(redirect, req.url), { status: 303 });
}
