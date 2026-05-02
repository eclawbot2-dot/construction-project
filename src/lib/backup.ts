/**
 * Per-tenant backup.
 *
 * The host runs on Windows + SQLite + Cloudflare tunnel; off-machine
 * disaster recovery isn't built into the storage layer. This module gives
 * each tenant a nightly self-contained JSON dump of its data graph,
 * written to a local backups directory and (optionally) mirrored to a
 * OneDrive / Google Drive sync folder configured per tenant.
 *
 * Why JSON-per-tenant rather than copying dev.db wholesale:
 *   1. dev.db carries every tenant's data, so a single file can't
 *      satisfy "per-tenant" backup destinations.
 *   2. JSON is portable across SQLite ↔ Postgres if the host ever moves.
 *   3. Restoring a single tenant from a multi-tenant dump is painful
 *      with raw SQL but trivial with an upsert loop over JSON.
 *
 * Caveats:
 *   - This is a logical export, not a physical replica. Foreign keys are
 *     captured by the row id columns; restore must walk the dependency
 *     graph in order.
 *   - File contents stored via the storage adapter (HistoricalImport.fileUrl,
 *     candidate resumes, etc.) are NOT included — paths only. The
 *     destination filesystem already syncs the storage root if the user
 *     has set their OneDrive folder at the workspace level.
 *   - Encryption is not applied here. If the destination requires
 *     encryption-at-rest beyond what OneDrive/GDrive provide, wrap the
 *     write step with a tenant-key envelope (TODO).
 */

import { mkdir, writeFile, copyFile, stat } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type TenantBackupResult = {
  tenantId: string;
  tenantSlug: string;
  ok: boolean;
  bytes?: number;
  localPath?: string;
  externalPath?: string;
  rows?: Record<string, number>;
  error?: string;
};

/**
 * Dump one tenant's data graph to JSON. Returns the byte size and the
 * paths written. Never throws — errors are returned in the result so the
 * caller can keep iterating other tenants.
 */
export async function backupTenant(tenantId: string): Promise<TenantBackupResult> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    return { tenantId, tenantSlug: "?", ok: false, error: "tenant not found" };
  }
  if (!tenant.backupEnabled) {
    return { tenantId, tenantSlug: tenant.slug, ok: false, error: "backups disabled for this tenant" };
  }

  try {
    const data = await collectTenantData(tenantId);
    const rowCounts = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, Array.isArray(v) ? v.length : v == null ? 0 : 1]),
    );

    const today = new Date();
    const yyyymmdd = today.toISOString().slice(0, 10);
    const filename = `${yyyymmdd}.json`;
    const localDir = path.join(process.cwd(), "uploads", "backups", tenant.slug);
    const localPath = path.join(localDir, filename);

    const payload = JSON.stringify(
      {
        meta: {
          tenantId,
          tenantSlug: tenant.slug,
          tenantName: tenant.name,
          generatedAt: today.toISOString(),
          schemaVersion: 1,
        },
        rowCounts,
        data,
      },
      (_key, v) => (v instanceof Date ? v.toISOString() : v),
      2,
    );

    await mkdir(localDir, { recursive: true });
    await writeFile(localPath, payload);

    let externalPath: string | undefined;
    if (tenant.backupDirectory) {
      try {
        await mkdir(tenant.backupDirectory, { recursive: true });
        externalPath = path.join(tenant.backupDirectory, filename);
        await copyFile(localPath, externalPath);
      } catch (err) {
        console.error(`[backup] external copy failed for tenant ${tenant.slug}`, err);
        externalPath = undefined;
      }
    }

    const fileStat = await stat(localPath);

    await prisma.tenant.update({
      where: { id: tenantId },
      data: { lastBackupAt: today, lastBackupBytes: fileStat.size, lastBackupError: null },
    });

    return {
      tenantId,
      tenantSlug: tenant.slug,
      ok: true,
      bytes: fileStat.size,
      localPath,
      externalPath,
      rows: rowCounts,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { lastBackupError: message.slice(0, 500), lastBackupAt: new Date() },
    }).catch(() => {});
    return { tenantId, tenantSlug: tenant.slug, ok: false, error: message };
  }
}

/**
 * Iterate every backupEnabled tenant. Returns one result per tenant.
 */
export async function backupAllTenants(): Promise<TenantBackupResult[]> {
  const tenants = await prisma.tenant.findMany({
    where: { backupEnabled: true },
    select: { id: true },
  });
  const results: TenantBackupResult[] = [];
  for (const t of tenants) {
    results.push(await backupTenant(t.id));
  }
  return results;
}

/**
 * Walk all tenant-scoped collections and emit them in a stable shape.
 * Adding a new tenant-scoped table is a one-line addition here. Order
 * within each collection matches schema declaration order so diffs
 * across nightly snapshots are easy to read.
 */
async function collectTenantData(tenantId: string) {
  const where: Prisma.ProjectWhereInput = { tenantId };
  const projectScope = { project: { tenantId } };

  const [
    tenant,
    businessUnits,
    memberships,
    projects,
    companies,
    contacts,
    workflowTemplates,
    notificationRules,
    historicalEstimates,
    opportunities,
    vendors,
    insuranceCerts,
    rfpSources,
    rfpListings,
    bidDrafts,
    bidDraftSections,
    bidDraftLineItems,
    complianceChecks,
    complianceItems,
    chartOfAccounts,
    financialStatements,
    journalEntries,
    invoiceInbox,
    invoiceInboxMessages,
    alertRules,
    alertEvents,
    historicalImports,
    historicalImportRows,
    aiRuns,
    recordComments,
    candidates,
    jobRequisitions,
    submissions,
    placements,
    commissionRules,
    commissionAccruals,
    captureRecords,
    captureMilestones,
    colorTeamReviews,
    goNoGoDecisions,
    teamingPartners,
    onboardingPaths,
    onboardingSteps,
    bidProfile,
    auditEvents,
    threads,
    threadMessages,
    tasks,
    rfis,
    submittals,
    documents,
    drawings,
    drawingSheets,
    specSections,
    dailyLogs,
    crewAssignments,
    productionEntries,
    quantities,
    tickets,
    safetyIncidents,
    punchItems,
    meetings,
    inspections,
    inspectionChecklistItems,
    inspectionAttachments,
    permits,
    contracts,
    contractCommitments,
    payApplications,
    payApplicationLines,
    lienWaivers,
    changeOrders,
    changeOrderLines,
    purchaseOrders,
    subInvoices,
    timeEntries,
    timeEntryComments,
    bidPackages,
    subBids,
    warrantyItems,
    workflowRuns,
    watchers,
    approvalRoutes,
    approvals,
    equipmentRecords,
    materialRecords,
    scheduleTasks,
    scheduleDependencies,
    budgets,
    budgetLines,
    revenueProjections,
    pnlSnapshots,
  ] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId } }),
    prisma.businessUnit.findMany({ where: { tenantId } }),
    prisma.membership.findMany({ where: { tenantId } }),
    prisma.project.findMany({ where }),
    prisma.company.findMany({ where: { tenantId } }),
    prisma.contact.findMany({ where: { tenantId } }),
    prisma.workflowTemplate.findMany({ where: { tenantId } }),
    prisma.notificationRule.findMany({ where: { tenantId } }),
    prisma.historicalEstimate.findMany({ where: { tenantId } }),
    prisma.opportunity.findMany({ where: { tenantId } }),
    prisma.vendor.findMany({ where: { tenantId } }),
    prisma.insuranceCert.findMany({ where: { vendor: { tenantId } } }),
    prisma.rfpSource.findMany({ where: { tenantId } }),
    prisma.rfpListing.findMany({ where: { tenantId } }),
    prisma.bidDraft.findMany({ where: { tenantId } }),
    prisma.bidDraftSection.findMany({ where: { draft: { tenantId } } }),
    prisma.bidDraftLineItem.findMany({ where: { draft: { tenantId } } }),
    prisma.complianceCheck.findMany({ where: { draft: { tenantId } } }),
    prisma.complianceItem.findMany({ where: { run: { draft: { tenantId } } } }),
    prisma.chartOfAccount.findMany({ where: { tenantId } }),
    prisma.financialStatement.findMany({ where: { tenantId } }),
    prisma.journalEntryRow.findMany({ where: { tenantId } }),
    prisma.invoiceInboxConnection.findMany({ where: { tenantId } }),
    prisma.invoiceInboxMessage.findMany({ where: { tenantId } }),
    prisma.alertRule.findMany({ where: { tenantId } }),
    prisma.alertEvent.findMany({ where: { tenantId } }),
    prisma.historicalImport.findMany({ where: { tenantId } }),
    prisma.historicalImportRow.findMany({ where: { import: { tenantId } } }),
    prisma.aiRunLog.findMany({ where: { tenantId } }),
    prisma.recordComment.findMany({ where: { tenantId } }),
    prisma.candidate.findMany({ where: { tenantId } }),
    prisma.jobRequisition.findMany({ where: { tenantId } }),
    prisma.submission.findMany({ where: { tenantId } }),
    prisma.placement.findMany({ where: { tenantId } }),
    prisma.commissionRule.findMany({ where: { tenantId } }),
    prisma.commissionAccrual.findMany({ where: { tenantId } }),
    prisma.captureRecord.findMany({ where: { tenantId } }),
    prisma.captureMilestone.findMany({ where: { capture: { tenantId } } }),
    prisma.colorTeamReview.findMany({ where: { capture: { tenantId } } }),
    prisma.goNoGoDecision.findMany({ where: { capture: { tenantId } } }),
    prisma.teamingPartner.findMany({ where: { capture: { tenantId } } }),
    prisma.onboardingPath.findMany({ where: { tenantId } }),
    prisma.onboardingStep.findMany({ where: { path: { tenantId } } }),
    prisma.tenantBidProfile.findMany({ where: { tenantId } }),
    prisma.auditEvent.findMany({ where: { tenantId } }),
    prisma.thread.findMany({ where: projectScope }),
    prisma.threadMessage.findMany({ where: { thread: projectScope } }),
    prisma.task.findMany({ where: projectScope }),
    prisma.rFI.findMany({ where: projectScope }),
    prisma.submittal.findMany({ where: projectScope }),
    prisma.document.findMany({ where: projectScope }),
    prisma.drawing.findMany({ where: projectScope }),
    prisma.drawingSheet.findMany({ where: { drawing: projectScope } }),
    prisma.specSection.findMany({ where: projectScope }),
    prisma.dailyLog.findMany({ where: projectScope }),
    prisma.crewAssignment.findMany({ where: projectScope }),
    prisma.productionEntry.findMany({ where: projectScope }),
    prisma.quantityBudget.findMany({ where: projectScope }),
    prisma.ticket.findMany({ where: projectScope }),
    prisma.safetyIncident.findMany({ where: projectScope }),
    prisma.punchItem.findMany({ where: projectScope }),
    prisma.meeting.findMany({ where: projectScope }),
    prisma.inspection.findMany({ where: projectScope }),
    prisma.inspectionChecklistItem.findMany({ where: { inspection: projectScope } }),
    prisma.inspectionAttachment.findMany({ where: { inspection: projectScope } }),
    prisma.permit.findMany({ where: projectScope }),
    prisma.contract.findMany({ where: projectScope }),
    prisma.contractCommitment.findMany({ where: { contract: projectScope } }),
    prisma.payApplication.findMany({ where: projectScope }),
    prisma.payApplicationLine.findMany({ where: { payApplication: projectScope } }),
    prisma.lienWaiver.findMany({ where: projectScope }),
    prisma.changeOrder.findMany({ where: projectScope }),
    prisma.changeOrderLine.findMany({ where: { changeOrder: projectScope } }),
    prisma.purchaseOrder.findMany({ where: projectScope }),
    prisma.subInvoice.findMany({ where: projectScope }),
    prisma.timeEntry.findMany({ where: projectScope }),
    prisma.timeEntryComment.findMany({ where: { entry: projectScope } }),
    prisma.bidPackage.findMany({ where: projectScope }),
    prisma.subBid.findMany({ where: { bidPackage: projectScope } }),
    prisma.warrantyItem.findMany({ where: projectScope }),
    prisma.workflowRun.findMany({ where: projectScope }),
    prisma.watcher.findMany({ where: projectScope }),
    prisma.approvalRoute.findMany({ where: projectScope }),
    prisma.approval.findMany({ where: { tenantId } }),
    prisma.equipmentRecord.findMany({ where: projectScope }),
    prisma.materialRecord.findMany({ where: projectScope }),
    prisma.scheduleTask.findMany({ where: projectScope }),
    prisma.scheduleDependency.findMany({ where: { predecessor: projectScope } }),
    prisma.budget.findMany({ where: projectScope }),
    prisma.budgetLine.findMany({ where: { budget: projectScope } }),
    prisma.revenueProjection.findMany({ where: projectScope }),
    prisma.projectPnlSnapshot.findMany({ where: projectScope }),
  ]);

  return {
    tenant,
    businessUnits,
    memberships,
    projects,
    companies,
    contacts,
    workflowTemplates,
    notificationRules,
    historicalEstimates,
    opportunities,
    vendors,
    insuranceCerts,
    rfpSources,
    rfpListings,
    bidDrafts,
    bidDraftSections,
    bidDraftLineItems,
    complianceChecks,
    complianceItems,
    chartOfAccounts,
    financialStatements,
    journalEntries,
    invoiceInbox,
    invoiceInboxMessages,
    alertRules,
    alertEvents,
    historicalImports,
    historicalImportRows,
    aiRuns,
    recordComments,
    candidates,
    jobRequisitions,
    submissions,
    placements,
    commissionRules,
    commissionAccruals,
    captureRecords,
    captureMilestones,
    colorTeamReviews,
    goNoGoDecisions,
    teamingPartners,
    onboardingPaths,
    onboardingSteps,
    bidProfile,
    auditEvents,
    threads,
    threadMessages,
    tasks,
    rfis,
    submittals,
    documents,
    drawings,
    drawingSheets,
    specSections,
    dailyLogs,
    crewAssignments,
    productionEntries,
    quantities,
    tickets,
    safetyIncidents,
    punchItems,
    meetings,
    inspections,
    inspectionChecklistItems,
    inspectionAttachments,
    permits,
    contracts,
    contractCommitments,
    payApplications,
    payApplicationLines,
    lienWaivers,
    changeOrders,
    changeOrderLines,
    purchaseOrders,
    subInvoices,
    timeEntries,
    timeEntryComments,
    bidPackages,
    subBids,
    warrantyItems,
    workflowRuns,
    watchers,
    approvalRoutes,
    approvals,
    equipmentRecords,
    materialRecords,
    scheduleTasks,
    scheduleDependencies,
    budgets,
    budgetLines,
    revenueProjections,
    pnlSnapshots,
  };
}
