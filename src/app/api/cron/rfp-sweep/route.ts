import { NextRequest, NextResponse } from "next/server";
import { sweepAllSources } from "@/lib/rfp-autopilot";

// Scheduled sweep endpoint — intended to be hit by an external scheduler
// (cron, Cloudflare Worker, GitHub Action) at least 6x per business day.
// Cadence gating inside sweepAllSources ensures we don't hammer sources.
//
// Auth: requires `Authorization: Bearer <CRON_SECRET>` header. We refuse to
// run without CRON_SECRET configured — an open cron endpoint lets anyone
// trigger external scrapes (cost + abuse risk) and exposes the autopilot's
// state across all tenants.

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

function authorize(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/rfp-sweep] CRON_SECRET not configured");
    return NextResponse.json({ error: "Cron not configured" }, { status: 503 });
  }
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (!timingSafeEqual(header, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function POST(req: NextRequest) {
  const denied = authorize(req);
  if (denied) return denied;
  const result = await sweepAllSources();
  return NextResponse.json(result);
}

export async function GET(req: NextRequest) {
  const denied = authorize(req);
  if (denied) return denied;
  const result = await sweepAllSources();
  return NextResponse.json(result);
}
