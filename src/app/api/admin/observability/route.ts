import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { snapshot } from "@/lib/metrics";

/**
 * Returns the observability snapshot for the admin UI. Super-admin only;
 * the data exposes per-route latency + recent error messages which are
 * sensitive enough to gate behind the highest privilege.
 *
 * Default window is 1 hour. Override with ?windowMinutes=15 etc.
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.superAdmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const url = new URL(req.url);
  const windowMinutes = Math.max(1, Math.min(1440, Number(url.searchParams.get("windowMinutes") ?? "60")));
  const data = snapshot(windowMinutes * 60 * 1000);
  return NextResponse.json(data, {
    headers: { "cache-control": "no-store" },
  });
}
