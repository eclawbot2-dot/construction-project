import { NextResponse } from "next/server";
import { sweepAllSources } from "@/lib/rfp-autopilot";

/** Tenant-facing sweep trigger — runs sweep across every active source, then redirects back to /bids/sources. */
export async function POST(req: Request) {
  await sweepAllSources();
  return NextResponse.redirect(new URL(`/bids/sources`, req.url), { status: 303 });
}
