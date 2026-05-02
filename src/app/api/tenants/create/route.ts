import { NextResponse } from "next/server";
import { createTenant } from "@/lib/tenant-admin";
import { requireSuperAdmin } from "@/lib/permissions";
import { publicRedirect } from "@/lib/redirect";
import type { ProjectMode } from "@prisma/client";

const VALID_MODES: ProjectMode[] = ["SIMPLE", "VERTICAL", "HEAVY_CIVIL"];

export async function POST(req: Request) {
  await requireSuperAdmin();
  const form = await req.formData();
  const name = String(form.get("name") ?? "");
  const slug = String(form.get("slug") ?? "");
  const primaryMode = String(form.get("primaryMode") ?? "VERTICAL") as ProjectMode;
  const enabledModesRaw = form.getAll("enabledModes").map((v) => String(v)) as ProjectMode[];
  const enabledModes = enabledModesRaw.filter((m) => VALID_MODES.includes(m));
  const adminName = form.get("adminName") ? String(form.get("adminName")) : undefined;
  const adminEmail = form.get("adminEmail") ? String(form.get("adminEmail")) : undefined;
  const businessUnitName = form.get("businessUnitName") ? String(form.get("businessUnitName")) : undefined;
  const region = form.get("region") ? String(form.get("region")) : undefined;
  const switchTo = form.get("switchTo") === "on";

  if (!VALID_MODES.includes(primaryMode)) {
    return NextResponse.json({ error: "Invalid primary mode." }, { status: 400 });
  }

  const result = await createTenant({
    name,
    slug,
    primaryMode,
    enabledModes,
    adminName,
    adminEmail,
    businessUnitName,
    region,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  // Pass-11: surface adminTempPassword via one-shot URL params on the
  // admin tenant detail page so the operator can hand it off out-of-band.
  // (The /admin/tenants/[id] page renders a one-time copy-and-dismiss
  // banner.) Falls back to /settings if no temp password was minted.
  const target = result.adminTempPassword
    ? `/admin/tenants/${result.tenantId}?adminEmail=${encodeURIComponent(result.adminEmail)}&adminTemp=${encodeURIComponent(result.adminTempPassword)}`
    : `/settings`;
  const res = publicRedirect(req, target, 303);
  if (switchTo) {
    res.cookies.set("cx.tenant", result.slug, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  }
  return res;
}
