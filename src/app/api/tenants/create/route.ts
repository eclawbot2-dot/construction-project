import { NextResponse } from "next/server";
import { createTenant } from "@/lib/tenant-admin";
import { publicRedirect } from "@/lib/redirect";
import type { ProjectMode } from "@prisma/client";

const VALID_MODES: ProjectMode[] = ["SIMPLE", "VERTICAL", "HEAVY_CIVIL"];

export async function POST(req: Request) {
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

  if (switchTo) {
    const res = publicRedirect(req, `/settings`, 303);
    res.cookies.set("cx.tenant", result.slug, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
    return res;
  }
  return publicRedirect(req, `/settings`, 303);
}
