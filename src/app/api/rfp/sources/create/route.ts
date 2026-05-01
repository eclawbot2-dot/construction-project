import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireManager } from "@/lib/permissions";
import { encryptSecret } from "@/lib/rfp-geo";
import { publicRedirect } from "@/lib/redirect";

export async function POST(req: Request) {
  const tenant = await requireTenant();
  await requireManager(tenant.id);
  const form = await req.formData();
  const label = String(form.get("label") ?? "").trim();
  const url = String(form.get("url") ?? "").trim();
  if (!label || !url) return NextResponse.json({ error: "label and url are required" }, { status: 400 });

  await prisma.rfpSource.create({
    data: {
      tenantId: tenant.id,
      label,
      url,
      agencyHint: String(form.get("agencyHint") ?? "") || null,
      cadence: String(form.get("cadence") ?? "DAILY"),
      naicsFilter: String(form.get("naicsFilter") ?? "") || null,
      keywordsJson: JSON.stringify(String(form.get("keywords") ?? "").split(",").map((s) => s.trim()).filter(Boolean)),
      setAsideFilter: String(form.get("setAsideFilter") ?? "") || null,
      geoScope: String(form.get("geoScope") ?? "") || null,
      geoCity: String(form.get("geoCity") ?? "") || null,
      geoState: String(form.get("geoState") ?? "") || null,
      geoCountry: String(form.get("geoCountry") ?? "US"),
      authType: String(form.get("authType") ?? "NONE"),
      authUsername: String(form.get("authUsername") ?? "") || null,
      authPasswordEnc: encryptSecret(tenant.id, String(form.get("authPassword") ?? "") || null),
      authApiKeyEnc: encryptSecret(tenant.id, String(form.get("authApiKey") ?? "") || null),
      authNotes: String(form.get("authNotes") ?? "") || null,
      autoLogin: String(form.get("autoLogin") ?? "") === "on",
    },
  });

  return publicRedirect(req, "/bids/sources", 303);
}
