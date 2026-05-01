import { NextResponse } from "next/server";
import { createTenant } from "@/lib/tenant-admin";
import { requireSuperAdmin } from "@/lib/permissions";
import { publicRedirect } from "@/lib/redirect";
import type { ProjectMode } from "@prisma/client";

const VALID_MODES: ProjectMode[] = ["SIMPLE", "VERTICAL", "HEAVY_CIVIL"];

export async function POST(req: Request) {
  await requireSuperAdmin();
  const form = await req.formData();
  const enabledModes = form.getAll("enabledModes").map((v) => String(v) as ProjectMode).filter((m) => VALID_MODES.includes(m));
  const result = await createTenant({
    name: String(form.get("name") ?? ""),
    slug: String(form.get("slug") ?? ""),
    primaryMode: String(form.get("primaryMode") ?? "VERTICAL") as ProjectMode,
    enabledModes,
    adminName: form.get("adminName") ? String(form.get("adminName")) : undefined,
    adminEmail: form.get("adminEmail") ? String(form.get("adminEmail")) : undefined,
    businessUnitName: form.get("businessUnitName") ? String(form.get("businessUnitName")) : undefined,
    region: form.get("region") ? String(form.get("region")) : undefined,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  // If a brand-new admin user was minted, include their temp password
  // as a one-shot query param so the super-admin can copy it. The
  // detail page renders this exactly once and discards. URL exposure
  // is acceptable since the password must be reset on first login.
  const target = result.adminTempPassword
    ? `/admin/tenants/${result.tenantId}?adminEmail=${encodeURIComponent(result.adminEmail)}&adminTemp=${encodeURIComponent(result.adminTempPassword)}`
    : `/admin/tenants/${result.tenantId}`;
  const res = publicRedirect(req, target, 303);
  if (form.get("switchTo") === "on") {
    res.cookies.set("cx.tenant", result.slug, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  }
  return res;
}
