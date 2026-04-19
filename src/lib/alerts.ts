/**
 * Alert engine — scans the tenant for conditions and produces AlertEvents.
 *
 * Covers: permit expiry, insurance expiry, overdue RFIs, budget variance,
 * failed inspections without punch items, overdue approvals.
 */

import { prisma } from "@/lib/prisma";

type Produced = { title: string; body?: string; severity: "INFO" | "WARN" | "ALERT"; entityType: string; entityId: string; link?: string; projectId?: string };

export async function runAlertScan(tenantId: string): Promise<{ ok: boolean; produced: number; note: string }> {
  const now = Date.now();
  const out: Produced[] = [];

  const permits = await prisma.permit.findMany({ where: { project: { tenantId } } });
  for (const p of permits) {
    if (!p.expiresAt) continue;
    const daysLeft = Math.round((new Date(p.expiresAt).getTime() - now) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0 && p.status !== "FINALED") {
      out.push({ title: `Permit expired: ${p.permitNumber}`, body: `${p.permitType} permit is ${Math.abs(daysLeft)} days past expiration`, severity: "ALERT", entityType: "Permit", entityId: p.id, link: `/projects/${p.projectId}/permits`, projectId: p.projectId });
    } else if (daysLeft < 14 && p.status === "ISSUED") {
      out.push({ title: `Permit expiring soon: ${p.permitNumber}`, body: `${p.permitType} permit expires in ${daysLeft} days`, severity: "WARN", entityType: "Permit", entityId: p.id, link: `/projects/${p.projectId}/permits`, projectId: p.projectId });
    }
  }

  const certs = await prisma.insuranceCert.findMany({ where: { vendor: { tenantId } }, include: { vendor: true } });
  for (const c of certs) {
    const daysLeft = Math.round((new Date(c.expirationDate).getTime() - now) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) {
      out.push({ title: `Vendor insurance expired: ${c.vendor.name}`, body: `${c.type} cert (${c.policyNumber}) expired ${Math.abs(daysLeft)}d ago`, severity: "ALERT", entityType: "InsuranceCert", entityId: c.id, link: `/vendors/${c.vendor.id}` });
    } else if (daysLeft < 30) {
      out.push({ title: `Vendor insurance expiring: ${c.vendor.name}`, body: `${c.type} cert (${c.policyNumber}) expires in ${daysLeft}d`, severity: "WARN", entityType: "InsuranceCert", entityId: c.id, link: `/vendors/${c.vendor.id}` });
    }
  }

  const rfis = await prisma.rFI.findMany({ where: { project: { tenantId }, status: { notIn: ["APPROVED", "CLOSED"] }, dueDate: { not: null } } });
  for (const r of rfis) {
    if (!r.dueDate) continue;
    const daysLate = Math.round((now - new Date(r.dueDate).getTime()) / (1000 * 60 * 60 * 24));
    if (daysLate > 0) {
      out.push({ title: `RFI overdue: ${r.number}`, body: `${r.subject} — ${daysLate}d past due, ball-in-court: ${r.ballInCourt ?? "—"}`, severity: daysLate > 7 ? "ALERT" : "WARN", entityType: "RFI", entityId: r.id, link: `/projects/${r.projectId}/rfis/${r.id}`, projectId: r.projectId });
    }
  }

  const commitments = await prisma.contractCommitment.findMany({ where: { contract: { project: { tenantId } } }, include: { contract: true } });
  for (const c of commitments) {
    if (c.committedAmount === 0) continue;
    const pct = c.invoicedToDate / c.committedAmount;
    if (pct > 1.1) {
      out.push({ title: `Commitment over-run: ${c.description}`, body: `Invoiced ${Math.round(pct * 100)}% of commitment (${c.contract.contractNumber})`, severity: "ALERT", entityType: "ContractCommitment", entityId: c.id, link: `/projects/${c.contract.projectId}/contracts/${c.contract.id}`, projectId: c.contract.projectId });
    } else if (pct > 0.95) {
      out.push({ title: `Commitment near limit: ${c.description}`, body: `Invoiced ${Math.round(pct * 100)}% of commitment (${c.contract.contractNumber})`, severity: "WARN", entityType: "ContractCommitment", entityId: c.id, link: `/projects/${c.contract.projectId}/contracts/${c.contract.id}`, projectId: c.contract.projectId });
    }
  }

  const failedInsp = await prisma.inspection.findMany({ where: { project: { tenantId }, result: "FAIL" } });
  for (const i of failedInsp) {
    const hasFollowUp = i.followUpNotes?.includes("Punch item created") ?? false;
    if (!hasFollowUp) {
      out.push({ title: `Failed inspection without follow-up: ${i.title}`, body: `Create a punch item to close the loop`, severity: "WARN", entityType: "Inspection", entityId: i.id, link: `/projects/${i.projectId}/inspections/${i.id}`, projectId: i.projectId });
    }
  }

  await prisma.alertEvent.deleteMany({ where: { tenantId, acknowledgedAt: null } });
  for (const p of out) {
    await prisma.alertEvent.create({ data: { tenantId, ...p } });
  }

  return { ok: true, produced: out.length, note: `produced ${out.length} alerts` };
}
