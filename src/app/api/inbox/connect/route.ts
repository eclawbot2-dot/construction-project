import { NextResponse } from "next/server";
import { connectInvoiceInbox, disconnectInvoiceInbox, pollInvoiceInbox } from "@/lib/invoice-inbox";
import { requireTenant } from "@/lib/tenant";

export async function POST(req: Request) {
  const tenant = await requireTenant();
  const form = await req.formData();
  const action = String(form.get("action") ?? "connect");
  if (action === "disconnect") {
    await disconnectInvoiceInbox(tenant.id);
  } else if (action === "poll") {
    await pollInvoiceInbox(tenant.id);
  } else {
    const mailbox = String(form.get("mailbox") ?? `ap@${tenant.slug}.example`);
    const labelFilter = String(form.get("labelFilter") ?? "Invoices");
    const allowlist = (String(form.get("senderAllowlist") ?? "").split(",").map((s) => s.trim()).filter(Boolean));
    await connectInvoiceInbox(tenant.id, mailbox, labelFilter, allowlist);
  }
  const redirect = String(form.get("redirect") ?? "/finance/inbox");
  return NextResponse.redirect(new URL(redirect, req.url), { status: 303 });
}
