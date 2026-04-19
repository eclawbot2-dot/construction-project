import { NextResponse } from "next/server";
import { runAlertScan } from "@/lib/alerts";
import { requireTenant } from "@/lib/tenant";

export async function POST(req: Request) {
  const tenant = await requireTenant();
  const result = await runAlertScan(tenant.id);
  return NextResponse.redirect(new URL("/alerts", req.url), { status: 303 });
}
