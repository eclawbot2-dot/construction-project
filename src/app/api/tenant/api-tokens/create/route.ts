import { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/tenant";
import { auth } from "@/lib/auth";
import { issueApiToken } from "@/lib/api-token";

export async function POST(req: NextRequest) {
  const tenant = await requireTenant();
  const form = await req.formData();
  const name = (form.get("name") as string | null)?.trim();
  if (!name) redirect("/settings/api?error=name+required");
  const scopes = ((form.get("scopes") as string | null) ?? "")
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const session = await auth();
  const issued = await issueApiToken({ tenantId: tenant.id, name: name!, scopes, createdById: session?.userId });
  redirect(`/settings/api?issued=${encodeURIComponent(issued.fullToken)}`);
}
