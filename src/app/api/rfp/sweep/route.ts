import { sweepAllSources } from "@/lib/rfp-autopilot";
import { publicRedirect } from "@/lib/redirect";

/** Tenant-facing sweep trigger — runs sweep across every active source, then redirects back to /bids/sources. */
export async function POST(req: Request) {
  await sweepAllSources();
  return publicRedirect(req, `/bids/sources`, 303);
}
