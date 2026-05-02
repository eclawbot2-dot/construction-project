import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";

export async function POST(req: NextRequest) {
  const tenant = await requireTenant();
  const form = await req.formData();
  const url = (form.get("url") as string | null)?.trim();
  if (!url || !/^https?:\/\//.test(url)) redirect("/settings/api?error=valid+url+required");
  const events = ((form.get("events") as string | null) ?? "*")
    .split(/\s+/).map((s) => s.trim()).filter(Boolean);
  const secret = crypto.randomBytes(24).toString("base64url");
  await prisma.webhookEndpoint.create({
    data: {
      tenantId: tenant.id,
      url: url!,
      secret,
      eventsJson: JSON.stringify(events.length ? events : ["*"]),
    },
  });
  redirect("/settings/api?ok=Webhook+created");
}
