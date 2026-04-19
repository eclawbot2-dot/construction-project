import { NextResponse } from "next/server";
import { sweepAllSources } from "@/lib/rfp-autopilot";

/**
 * Scheduled sweep endpoint — intended to be hit by an external scheduler
 * (cron, Cloudflare Worker, GitHub Action) at least 6x per business day.
 * Cadence gating inside sweepAllSources ensures we don't hammer sources.
 */
export async function POST() {
  const result = await sweepAllSources();
  return NextResponse.json(result);
}

export async function GET() {
  const result = await sweepAllSources();
  return NextResponse.json(result);
}
