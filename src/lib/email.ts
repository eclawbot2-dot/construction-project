/**
 * Transactional email transport. Pluggable: Resend, SendGrid, or SMTP
 * via Nodemailer-equivalent. Picks based on env vars.
 *
 *   EMAIL_TRANSPORT=resend  (RESEND_API_KEY, EMAIL_FROM)
 *   EMAIL_TRANSPORT=sendgrid (SENDGRID_API_KEY, EMAIL_FROM)
 *   EMAIL_TRANSPORT=smtp    (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM)
 *   (default — log only, no actual send)
 *
 * sendEmail() never throws — failures log a warn + return ok=false so
 * callers can handle. For batched delivery (digests, notification
 * fan-out), call sendEmail in a loop; the transports are async and
 * tolerant.
 */

import { log } from "@/lib/log";

export type EmailMessage = {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
};

export async function sendEmail(msg: EmailMessage): Promise<{ ok: boolean; transport: string; id?: string; error?: string }> {
  const transport = (process.env.EMAIL_TRANSPORT ?? "log").toLowerCase();
  const from = process.env.EMAIL_FROM ?? "no-reply@bcon.local";
  try {
    if (transport === "resend") return await sendViaResend(msg, from);
    if (transport === "sendgrid") return await sendViaSendgrid(msg, from);
    if (transport === "smtp") return await sendViaSmtp(msg, from);
    log.info("email (log-only transport)", { module: "email", to: msg.to, subject: msg.subject });
    return { ok: true, transport: "log" };
  } catch (err) {
    log.warn("email send failed", { module: "email", transport, to: msg.to }, err);
    return { ok: false, transport, error: err instanceof Error ? err.message : String(err) };
  }
}

async function sendViaResend(msg: EmailMessage, from: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY missing");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from,
      to: arr(msg.to),
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
      cc: msg.cc ? arr(msg.cc) : undefined,
      bcc: msg.bcc ? arr(msg.bcc) : undefined,
      reply_to: msg.replyTo,
    }),
  });
  if (!res.ok) throw new Error(`resend ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { id?: string };
  return { ok: true, transport: "resend", id: json.id };
}

async function sendViaSendgrid(msg: EmailMessage, from: string) {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) throw new Error("SENDGRID_API_KEY missing");
  const personalizations = [{ to: arr(msg.to).map((email) => ({ email })) }];
  const content: Array<{ type: string; value: string }> = [];
  if (msg.text) content.push({ type: "text/plain", value: msg.text });
  if (msg.html) content.push({ type: "text/html", value: msg.html });
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      personalizations,
      from: { email: from },
      subject: msg.subject,
      content,
    }),
  });
  if (!res.ok) throw new Error(`sendgrid ${res.status} ${await res.text()}`);
  return { ok: true, transport: "sendgrid", id: res.headers.get("x-message-id") ?? undefined };
}

async function sendViaSmtp(_msg: EmailMessage, _from: string): Promise<{ ok: boolean; transport: string }> {
  // Native SMTP without nodemailer is non-trivial. Stubbed for now —
  // when an operator wants SMTP, wire nodemailer in this file.
  throw new Error("EMAIL_TRANSPORT=smtp not implemented; install nodemailer and replace this stub");
}

function arr(v: string | string[]): string[] {
  return Array.isArray(v) ? v : [v];
}
