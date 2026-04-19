import { NextResponse } from "next/server";
import { connectQboDemo, disconnectQbo, syncFromQbo } from "@/lib/qbo-sync";
import { requireTenant } from "@/lib/tenant";

export async function POST(req: Request) {
  const tenant = await requireTenant();
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
  return NextResponse.redirect(new URL(redirect, req.url), { status: 303 });
}
