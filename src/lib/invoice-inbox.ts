/**
 * Google Workspace invoice inbox watcher.
 *
 * Watches a mailbox (label-filtered, e.g. `Invoices`) for new messages
 * from vendors, attempts to extract vendor + amount + project + cost
 * code from subject/body/attachments, and creates InvoiceInboxMessage
 * rows ready for reconciliation.
 *
 * In production: Gmail API with OAuth2, historyId watermarking, and
 * a periodic Pub/Sub subscriber. Here we simulate polling so the full
 * pipeline (poll → parse → match → post) works end-to-end.
 */

import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { CostReconciliationStatus, JournalEntryType } from "@prisma/client";
import { suggestProjectAllocation } from "@/lib/xero-sync";

export async function connectInvoiceInbox(tenantId: string, mailbox: string, labelFilter: string, senderAllowlist: string[]) {
  const existing = await prisma.invoiceInboxConnection.findUnique({ where: { tenantId } });
  const data = {
    provider: "google-workspace" as const,
    mailbox,
    labelFilter,
    senderAllowlist: JSON.stringify(senderAllowlist),
    status: "CONNECTED",
    accessToken: "demo-gmail-token",
    refreshToken: "demo-gmail-refresh",
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    lastPolledAt: null,
    lastPollStatus: null,
  };
  if (existing) {
    await prisma.invoiceInboxConnection.update({ where: { tenantId }, data });
  } else {
    await prisma.invoiceInboxConnection.create({ data: { tenantId, ...data } });
  }
}

export async function disconnectInvoiceInbox(tenantId: string) {
  await prisma.invoiceInboxConnection.upsert({
    where: { tenantId },
    update: { status: "DISCONNECTED", accessToken: null, refreshToken: null, lastPollStatus: "disconnected" },
    create: { tenantId, provider: "google-workspace", mailbox: "", labelFilter: "Invoices", status: "DISCONNECTED" },
  });
}

export async function pollInvoiceInbox(tenantId: string): Promise<{ ok: boolean; fetched: number; created: number; auto: number; note: string }> {
  const conn = await prisma.invoiceInboxConnection.findUnique({ where: { tenantId } });
  if (!conn || conn.status !== "CONNECTED") return { ok: false, fetched: 0, created: 0, auto: 0, note: "inbox not connected" };
  const projects = await prisma.project.findMany({ where: { tenantId }, select: { id: true, code: true, name: true, mode: true, ownerName: true } });

  const messages = simulateGmailPoll(tenantId, conn.mailbox, conn.labelFilter, conn.lastPolledAt ?? null);
  let created = 0;
  let autoMatched = 0;
  for (const msg of messages) {
    const existing = await prisma.invoiceInboxMessage.findUnique({ where: { externalMessageId: msg.externalMessageId } });
    if (existing) continue;
    const guess = suggestProjectAllocation(`${msg.subject} ${msg.body ?? ""}`, msg.vendorGuess, projects);
    const autoLink = guess.confidence >= 70;
    let journalRowId: string | null = null;
    if (autoLink && guess.projectId && msg.amountGuess != null) {
      const row = await prisma.journalEntryRow.create({
        data: {
          tenantId,
          entryDate: msg.receivedAt,
          memo: msg.subject,
          accountCode: "5020",
          accountName: "Direct Materials",
          entryType: JournalEntryType.COST_OF_GOODS,
          amount: -Math.abs(msg.amountGuess),
          vendorName: msg.vendorGuess ?? null,
          projectId: guess.projectId,
          reconciliationStatus: CostReconciliationStatus.SUGGESTED,
          allocationConfidence: guess.confidence,
          source: "email-inbox",
          emailMessageId: msg.externalMessageId,
          attachmentUrl: msg.attachmentUrl ?? null,
          reference: msg.subject,
        },
      });
      journalRowId = row.id;
      autoMatched += 1;
    }
    await prisma.invoiceInboxMessage.create({
      data: {
        tenantId,
        externalMessageId: msg.externalMessageId,
        subject: msg.subject,
        fromAddress: msg.fromAddress,
        receivedAt: msg.receivedAt,
        vendorGuess: msg.vendorGuess,
        amountGuess: msg.amountGuess,
        projectGuessId: guess.projectId,
        confidence: guess.confidence,
        status: autoLink ? "MATCHED" : guess.projectId ? "SUGGESTED" : "UNMATCHED",
        attachmentUrl: msg.attachmentUrl,
        journalRowId,
        notes: guess.reason,
      },
    });
    created += 1;
  }
  await prisma.invoiceInboxConnection.update({
    where: { tenantId },
    data: { lastPolledAt: new Date(), lastPollStatus: `fetched ${messages.length}, ${created} new, ${autoMatched} auto-linked` },
  });
  return { ok: true, fetched: messages.length, created, auto: autoMatched, note: `fetched ${messages.length}, ${created} new, ${autoMatched} auto-linked to journal` };
}

type FakeGmailMessage = {
  externalMessageId: string;
  subject: string;
  fromAddress: string;
  receivedAt: Date;
  vendorGuess: string | null;
  amountGuess: number | null;
  body: string;
  attachmentUrl: string | null;
};

function simulateGmailPoll(tenantId: string, mailbox: string, label: string, since: Date | null): FakeGmailMessage[] {
  void mailbox;
  void label;
  const hash = crypto.createHash("sha256").update(`${tenantId}:${(since ?? new Date()).toISOString().slice(0, 10)}`).digest();
  const count = 3 + (hash[0] % 6);
  const vendors = [
    { name: "Builder's Supply Co", domain: "billing@builders-supply.example" },
    { name: "Coastal Concrete Co", domain: "ap@coastalconcrete.example" },
    { name: "Sunbelt Rentals", domain: "invoices@sunbelt.example" },
    { name: "Atlantic Underground LLC", domain: "accounting@atlanticug.example" },
    { name: "Palmetto Steel Erectors", domain: "billing@palmettosteel.example" },
    { name: "Charleston Rebar", domain: "ar@charlestonrebar.example" },
  ];
  const subjectTemplates = [
    (v: string, amt: number) => `Invoice #${seq()} from ${v} — $${amt.toLocaleString()} for HPR-001 concrete delivery`,
    (v: string, amt: number) => `${v} Invoice ${seq()} - MPWM-211 water main materials $${amt.toLocaleString()}`,
    (v: string, amt: number) => `${v} / Statement #${seq()} / $${amt.toLocaleString()} / Ref: SBH-002 finish carpentry`,
    (v: string, amt: number) => `Rental invoice ${seq()} — RUPA-101 — $${amt.toLocaleString()}`,
    (v: string, amt: number) => `${v} weekly statement — $${amt.toLocaleString()}`,
  ];
  const msgs: FakeGmailMessage[] = [];
  for (let i = 0; i < count; i++) {
    const rng = hash[(i * 3) % hash.length] ?? 7;
    const vendor = vendors[rng % vendors.length];
    const amount = Math.round(((rng * 137) % 18000) + 450);
    const template = subjectTemplates[rng % subjectTemplates.length];
    const subject = template(vendor.name, amount);
    const receivedAt = new Date(Date.now() - ((rng % 7) + 1) * 60 * 60 * 1000);
    msgs.push({
      externalMessageId: `gmail-${tenantId.slice(-6)}-${(since ?? new Date()).toISOString().slice(0, 10)}-${i}`,
      subject,
      fromAddress: vendor.domain,
      receivedAt,
      vendorGuess: vendor.name,
      amountGuess: amount,
      body: `${vendor.name} is attaching invoice for amount $${amount}. Please post against appropriate project.`,
      attachmentUrl: `gmail-attachment://${seq()}.pdf`,
    });
  }
  return msgs;
}

let counter = 0;
function seq(): string {
  counter += 1;
  return `${Date.now().toString(36).slice(-4).toUpperCase()}${counter.toString().padStart(3, "0")}`;
}
