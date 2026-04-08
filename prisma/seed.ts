import "dotenv/config";
import path from "path";
import bcrypt from "bcryptjs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import {
  BudgetLineType,
  DocumentClass,
  PrismaClient,
  ProjectMode,
  ProjectStage,
  TaskStatus,
  ThreadChannel,
  UserRoleTemplate,
  WorkflowStatus,
} from "@prisma/client";

const configuredDbUrl = process.env.DATABASE_URL;
const dbUrl = configuredDbUrl
  ? (configuredDbUrl.startsWith("file:") ? configuredDbUrl : `file:${configuredDbUrl}`)
  : `file:${path.join(process.cwd(), "prisma", "dev.db")}`;
const adapter = new PrismaBetterSqlite3({ url: dbUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.notificationRule.deleteMany();
  await prisma.historicalEstimate.deleteMany();
  await prisma.materialRecord.deleteMany();
  await prisma.equipmentRecord.deleteMany();
  await prisma.approvalRoute.deleteMany();
  await prisma.watcher.deleteMany();
  await prisma.auditEvent.deleteMany();
  await prisma.approval.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.productionEntry.deleteMany();
  await prisma.quantityBudget.deleteMany();
  await prisma.budgetLine.deleteMany();
  await prisma.budget.deleteMany();
  await prisma.dailyLog.deleteMany();
  await prisma.meeting.deleteMany();
  await prisma.submittal.deleteMany();
  await prisma.rFI.deleteMany();
  await prisma.document.deleteMany();
  await prisma.task.deleteMany();
  await prisma.threadMessage.deleteMany();
  await prisma.thread.deleteMany();
  await prisma.workflowRun.deleteMany();
  await prisma.punchItem.deleteMany();
  await prisma.safetyIncident.deleteMany();
  await prisma.project.deleteMany();
  await prisma.workflowTemplate.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.company.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.businessUnit.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();

  const password = await bcrypt.hash("demo1234", 10);

  const [admin, exec, pm, superintendent] = await Promise.all([
    prisma.user.create({ data: { name: "Morgan Admin", email: "admin@construction.local", password } }),
    prisma.user.create({ data: { name: "Elena Executive", email: "exec@construction.local", password } }),
    prisma.user.create({ data: { name: "Paula PM", email: "pm@construction.local", password } }),
    prisma.user.create({ data: { name: "Sam Superintendent", email: "super@construction.local", password } }),
  ]);

  const tenant = await prisma.tenant.create({
    data: {
      name: "Jah Construction Group",
      slug: "jah-construction",
      primaryMode: ProjectMode.VERTICAL,
      enabledModes: JSON.stringify([ProjectMode.SIMPLE, ProjectMode.VERTICAL, ProjectMode.HEAVY_CIVIL]),
      featurePacks: JSON.stringify([
        "job-thread",
        "rfis",
        "heavy-civil-production",
        "historical-bid-intelligence",
        "approvals",
        "notifications",
      ]),
      terminology: JSON.stringify({ project: "Project", thread: "Job Thread", observation: "Punch Item" }),
      brandingTheme: "slate-gold",
    },
  });

  const [commercial, civil] = await Promise.all([
    prisma.businessUnit.create({ data: { tenantId: tenant.id, name: "Commercial Buildings", code: "COMM", defaultMode: ProjectMode.VERTICAL, region: "Southeast" } }),
    prisma.businessUnit.create({ data: { tenantId: tenant.id, name: "Heavy Civil", code: "CIVIL", defaultMode: ProjectMode.HEAVY_CIVIL, region: "Carolinas" } }),
  ]);

  await prisma.membership.createMany({
    data: [
      { tenantId: tenant.id, userId: admin.id, businessUnitId: commercial.id, roleTemplate: UserRoleTemplate.ADMIN },
      { tenantId: tenant.id, userId: exec.id, businessUnitId: commercial.id, roleTemplate: UserRoleTemplate.EXECUTIVE },
      { tenantId: tenant.id, userId: pm.id, businessUnitId: commercial.id, roleTemplate: UserRoleTemplate.MANAGER },
      { tenantId: tenant.id, userId: superintendent.id, businessUnitId: civil.id, roleTemplate: UserRoleTemplate.SUPERINTENDENT },
    ],
  });

  await prisma.notificationRule.createMany({
    data: [
      { tenantId: tenant.id, name: "RFI overdue escalation", roleTemplate: UserRoleTemplate.MANAGER, triggerType: "RFI_OVERDUE", delivery: "in-app+email", cadence: "hourly", slaHours: 24, configJson: JSON.stringify({ escalateTo: ["MANAGER", "EXECUTIVE"] }) },
      { tenantId: tenant.id, name: "Submittal digest", roleTemplate: UserRoleTemplate.PROJECT_ENGINEER, triggerType: "SUBMITTAL_DIGEST", delivery: "digest", cadence: "daily", slaHours: 12, configJson: JSON.stringify({ includeStatuses: ["UNDER_REVIEW", "REJECTED"] }) },
      { tenantId: tenant.id, name: "Heavy civil production alert", roleTemplate: UserRoleTemplate.SUPERINTENDENT, triggerType: "PRODUCTION_UNDERRUN", delivery: "in-app+sms", cadence: "instant", slaHours: 2, configJson: JSON.stringify({ thresholdPct: 15 }) },
    ],
  });

  await prisma.historicalEstimate.createMany({
    data: [
      { tenantId: tenant.id, mode: ProjectMode.VERTICAL, title: "Mid-rise multifamily shell benchmark", projectType: "Multifamily", geography: "Charleston", lineItemCode: "033000", unitCost: 182, confidencePct: 78, metadataJson: JSON.stringify({ assembly: "Concrete frame", source: "historical bid library" }) },
      { tenantId: tenant.id, mode: ProjectMode.HEAVY_CIVIL, title: "12in DIP utility install benchmark", projectType: "Water / Sewer", geography: "Lowcountry", lineItemCode: "P-014", unitCost: 275, productionRate: 54, confidencePct: 81, metadataJson: JSON.stringify({ activity: "Pipe install", source: "production history" }) },
    ],
  });

  const ownerCompany = await prisma.company.create({
    data: { tenantId: tenant.id, name: "Atlantic Development Partners", companyType: "Owner", market: "Multifamily", region: "Charleston" },
  });
  await prisma.contact.createMany({
    data: [
      { tenantId: tenant.id, companyId: ownerCompany.id, name: "Taylor Reed", email: "treed@atlantic.example", roleTitle: "Owner Rep" },
      { tenantId: tenant.id, name: "Jordan Cruz", email: "jcruz@gc.example", roleTitle: "Project Engineer" },
    ],
  });

  await prisma.workflowTemplate.createMany({
    data: [
      { tenantId: tenant.id, name: "Vertical Startup", mode: ProjectMode.VERTICAL, module: "project-core", configJson: JSON.stringify({ rfis: true, submittals: true, drawings: true, closeoutChecklist: true }) },
      { tenantId: tenant.id, name: "Heavy Civil Daily Production", mode: ProjectMode.HEAVY_CIVIL, module: "field-operations", configJson: JSON.stringify({ tickets: true, quantities: true, equipment: true, locationTags: true }) },
      { tenantId: tenant.id, name: "Simple Remodel Launch", mode: ProjectMode.SIMPLE, module: "job-thread", configJson: JSON.stringify({ homeownerPortal: true, punchList: true, approvalsInline: true }) },
    ],
  });

  const projects = await Promise.all([
    prisma.project.create({
      data: {
        tenantId: tenant.id,
        businessUnitId: commercial.id,
        name: "Harbor Point Residences",
        code: "HPR-001",
        mode: ProjectMode.VERTICAL,
        stage: ProjectStage.ACTIVE,
        address: "12 Cooper St, Charleston, SC",
        ownerName: ownerCompany.name,
        contractType: "GMP",
        contractValue: 28500000,
        marginTargetPct: 12.5,
        progressPct: 41,
        healthScore: 82,
        startDate: new Date("2026-02-01"),
        endDate: new Date("2027-06-15"),
        configurationJson: JSON.stringify({ dashboard: "vertical", aiBootstrapEnabled: true, requiredForms: ["RFI", "Submittal", "Meeting Minutes"], engagement: { ownerPortal: true, formalApprovals: true } }),
      },
    }),
    prisma.project.create({
      data: {
        tenantId: tenant.id,
        businessUnitId: civil.id,
        name: "Ravenel Utility Package A",
        code: "RUPA-101",
        mode: ProjectMode.HEAVY_CIVIL,
        stage: ProjectStage.ACTIVE,
        address: "Ravenel, SC",
        ownerName: "Charleston County",
        contractType: "Unit Price",
        contractValue: 9200000,
        marginTargetPct: 10.2,
        progressPct: 58,
        healthScore: 76,
        startDate: new Date("2026-01-15"),
        endDate: new Date("2026-11-20"),
        configurationJson: JSON.stringify({ dashboard: "heavy-civil", locationTracking: true, ticketReconciliation: true, aiBootstrapEnabled: true, engagement: { fieldFirst: true, supervisorEscalation: true } }),
      },
    }),
    prisma.project.create({
      data: {
        tenantId: tenant.id,
        businessUnitId: commercial.id,
        name: "Sullivan Kitchen Remodel",
        code: "SKR-014",
        mode: ProjectMode.SIMPLE,
        stage: ProjectStage.ACTIVE,
        address: "Sullivan's Island, SC",
        ownerName: "Private Client",
        contractType: "Lump Sum",
        contractValue: 185000,
        marginTargetPct: 18,
        progressPct: 64,
        healthScore: 91,
        startDate: new Date("2026-03-01"),
        endDate: new Date("2026-05-15"),
        configurationJson: JSON.stringify({ dashboard: "simple", clientPortal: true, subthreads: ["Selections", "Schedule", "Punch"], engagement: { fastApprovals: true, homeownerUpdates: true } }),
      },
    }),
  ]);

  for (const project of projects) {
    const generalThread = await prisma.thread.create({
      data: {
        projectId: project.id,
        title: `${project.name} Job Thread`,
        channel: ThreadChannel.GENERAL,
        isDefault: true,
      },
    });

    const workflowRun = await prisma.workflowRun.create({
      data: {
        projectId: project.id,
        templateName: project.mode === ProjectMode.VERTICAL ? "Vertical Startup" : project.mode === ProjectMode.HEAVY_CIVIL ? "Heavy Civil Daily Production" : "Simple Remodel Launch",
        module: project.mode === ProjectMode.SIMPLE ? "job-thread" : project.mode === ProjectMode.VERTICAL ? "technical-workflows" : "field-operations",
        status: WorkflowStatus.UNDER_REVIEW,
        payloadJson: JSON.stringify({ seeded: true, mode: project.mode }),
      },
    });

    await prisma.watcher.createMany({
      data: [
        { projectId: project.id, workflowRunId: workflowRun.id, userId: pm.id, channel: "email", objectType: "Project", objectId: project.id, required: true },
        { projectId: project.id, workflowRunId: workflowRun.id, userId: superintendent.id, channel: "in-app", objectType: "WorkflowRun", objectId: workflowRun.id, required: project.mode === ProjectMode.HEAVY_CIVIL },
      ],
    });

    await prisma.approvalRoute.create({
      data: {
        projectId: project.id,
        targetType: project.mode === ProjectMode.SIMPLE ? "ChangeOrder" : project.mode === ProjectMode.VERTICAL ? "SubmittalPackage" : "ProductionException",
        targetId: workflowRun.id,
        name: `${project.name} ${project.mode} approval route`,
        status: WorkflowStatus.UNDER_REVIEW,
        approverRole: project.mode === ProjectMode.HEAVY_CIVIL ? UserRoleTemplate.SUPERINTENDENT : UserRoleTemplate.MANAGER,
        stepsJson: JSON.stringify([
          { order: 1, role: "MANAGER", action: "review" },
          { order: 2, role: project.mode === ProjectMode.SIMPLE ? "EXECUTIVE" : "SUPERINTENDENT", action: "approve" },
        ]),
      },
    });

    await prisma.threadMessage.createMany({
      data: [
        { threadId: generalThread.id, authorId: admin.id, body: `Project shell bootstrapped for ${project.mode} mode with tenant-aware defaults.`, pinned: true },
        { threadId: generalThread.id, authorId: pm.id, body: `Kickoff complete. Tracking next actions, documents, approvals, and user engagement in the default job thread.`, decisionFlag: true },
      ],
    });

    await prisma.task.createMany({
      data: [
        {
          projectId: project.id,
          title: project.mode === ProjectMode.VERTICAL ? "Publish drawing register" : project.mode === ProjectMode.HEAVY_CIVIL ? "Validate pay item structure" : "Confirm client finish selections",
          description: "Seeded from mode-specific startup template",
          status: TaskStatus.IN_PROGRESS,
          priority: "High",
          dueDate: new Date("2026-04-10"),
          assigneeId: pm.id,
          sourceType: "workflow-template",
        },
        {
          projectId: project.id,
          title: project.mode === ProjectMode.VERTICAL ? "Issue first submittal package" : project.mode === ProjectMode.HEAVY_CIVIL ? "Reconcile hauling tickets" : "Update homeowner daily summary",
          status: TaskStatus.TODO,
          priority: "Medium",
          dueDate: new Date("2026-04-12"),
          assigneeId: superintendent.id,
          sourceType: "job-thread",
        },
      ],
    });

    await prisma.document.createMany({
      data: [
        { projectId: project.id, title: `${project.code} Contract Overview`, documentClass: DocumentClass.CONTRACT, folderPath: "/contracts", metadataJson: JSON.stringify({ source: "seed", version: 1 }) },
        { projectId: project.id, title: `${project.code} Startup Package`, documentClass: project.mode === ProjectMode.VERTICAL ? DocumentClass.DRAWING : DocumentClass.OTHER, folderPath: "/startup", metadataJson: JSON.stringify({ aiBootstrapCandidate: true }) },
      ],
    });

    await prisma.dailyLog.create({
      data: {
        projectId: project.id,
        logDate: new Date("2026-04-07"),
        weather: project.mode === ProjectMode.HEAVY_CIVIL ? "68F, clear, low wind" : "72F, partly cloudy",
        summary: project.mode === ProjectMode.VERTICAL ? "Curtainwall coordination ongoing, MEP overhead rough-in on Levels 3-4." : project.mode === ProjectMode.HEAVY_CIVIL ? "Installed 420 LF of 12in water main, trucking balanced with utility conflict watch." : "Cabinet install 80% complete; owner approved backsplash options.",
        manpower: project.mode === ProjectMode.SIMPLE ? 8 : project.mode === ProjectMode.VERTICAL ? 64 : 27,
        notes: "Seeded daily report for dashboard demo.",
      },
    });

    const budget = await prisma.budget.create({
      data: {
        projectId: project.id,
        name: "Current Control Budget",
        originalValue: project.contractValue ?? 0,
        currentValue: (project.contractValue ?? 0) * 1.04,
        forecastFinal: (project.contractValue ?? 0) * 1.03,
      },
    });

    await prisma.budgetLine.createMany({
      data: project.mode === ProjectMode.HEAVY_CIVIL
        ? [
            { budgetId: budget.id, code: "2010", description: "Earthwork / Excavation", lineType: BudgetLineType.COST_CODE, budgetAmount: 2200000, committedCost: 1900000, actualCost: 1280000 },
            { budgetId: budget.id, code: "P-014", description: "12in Water Main", lineType: BudgetLineType.PAY_ITEM, budgetAmount: 1450000, committedCost: 1300000, actualCost: 840000 },
          ]
        : [
            { budgetId: budget.id, code: "033000", description: project.mode === ProjectMode.VERTICAL ? "Cast-in-place concrete" : "Cabinet and finish package", lineType: BudgetLineType.COST_CODE, budgetAmount: project.mode === ProjectMode.VERTICAL ? 5200000 : 74000, committedCost: project.mode === ProjectMode.VERTICAL ? 4800000 : 61000, actualCost: project.mode === ProjectMode.VERTICAL ? 2600000 : 42000 },
            { budgetId: budget.id, code: "CO-001", description: "Owner-directed changes", lineType: BudgetLineType.ALLOWANCE, budgetAmount: project.mode === ProjectMode.VERTICAL ? 350000 : 12000, committedCost: project.mode === ProjectMode.VERTICAL ? 120000 : 7000, actualCost: project.mode === ProjectMode.VERTICAL ? 82000 : 5000 },
          ],
    });

    if (project.mode !== ProjectMode.SIMPLE) {
      await prisma.rFI.create({
        data: {
          projectId: project.id,
          number: project.mode === ProjectMode.VERTICAL ? "RFI-012" : "RFI-CIV-004",
          subject: project.mode === ProjectMode.VERTICAL ? "Curtainwall embed elevation conflict" : "Utility crossing depth clarification",
          status: WorkflowStatus.UNDER_REVIEW,
          dueDate: new Date("2026-04-11"),
          ballInCourt: "Design Team",
        },
      });

      await prisma.submittal.create({
        data: {
          projectId: project.id,
          number: project.mode === ProjectMode.VERTICAL ? "SUB-033" : "SUB-CIV-008",
          title: project.mode === ProjectMode.VERTICAL ? "Storefront system" : "Ductile iron pipe and fittings",
          specSection: project.mode === ProjectMode.VERTICAL ? "084113" : "331111",
          status: WorkflowStatus.UNDER_REVIEW,
          longLead: project.mode === ProjectMode.VERTICAL,
        },
      });
    }

    if (project.mode === ProjectMode.HEAVY_CIVIL) {
      await prisma.quantityBudget.createMany({
        data: [
          { projectId: project.id, code: "P-014", description: "12in Water Main", unit: "LF", budgetQty: 5200, installedQty: 3010, earnedQty: 2890, locationTag: "STA 10+00 to 41+20" },
          { projectId: project.id, code: "P-021", description: "Manhole Structure", unit: "EA", budgetQty: 18, installedQty: 10, earnedQty: 10, locationTag: "Segment B" },
        ],
      });

      await prisma.productionEntry.createMany({
        data: [
          { projectId: project.id, activity: "12in DIP install", crewName: "Pipe Crew 1", installedQty: 420, unit: "LF", productionRate: 52.5, equipmentHours: 18, locationTag: "STA 24+00 to 28+20" },
          { projectId: project.id, activity: "Backfill and compaction", crewName: "Earthwork Crew", installedQty: 380, unit: "CY", productionRate: 47.5, equipmentHours: 12, locationTag: "Segment B" },
        ],
      });

      await prisma.ticket.createMany({
        data: [
          { projectId: project.id, ticketNumber: "T-24017", materialType: "Fill Sand", quantity: 24, unit: "TON", source: "Ladson Quarry", destination: "Segment B" },
          { projectId: project.id, ticketNumber: "T-24018", materialType: "12in DIP", quantity: 420, unit: "LF", source: "Pipe Yard", destination: "STA 24+00" },
        ],
      });

      await prisma.equipmentRecord.createMany({
        data: [
          { projectId: project.id, equipmentCode: "EX-210", description: "Cat 320 Excavator", ownershipType: "Owned", assignedCrew: "Pipe Crew 1", utilizationHours: 8.5, status: "Active" },
          { projectId: project.id, equipmentCode: "RL-014", description: "Compaction Roller", ownershipType: "Rented", assignedCrew: "Earthwork Crew", utilizationHours: 6.25, status: "Active" },
        ],
      });

      await prisma.materialRecord.createMany({
        data: [
          { projectId: project.id, materialType: "Fill Sand", quantity: 24, unit: "TON", status: "Received", source: "Ladson Quarry", locationTag: "Segment B" },
          { projectId: project.id, materialType: "12in Ductile Iron Pipe", quantity: 420, unit: "LF", status: "Installed", source: "Pipe Yard", locationTag: "STA 24+00 to 28+20" },
        ],
      });
    }

    if (project.mode === ProjectMode.VERTICAL) {
      await prisma.meeting.create({
        data: {
          projectId: project.id,
          title: "OAC Coordination Meeting",
          meetingType: "OAC",
          scheduledAt: new Date("2026-04-09T14:00:00Z"),
          notes: "Submittal aging, procurement risks, and Level 4 rough-in coordination.",
        },
      });
    }

    await prisma.auditEvent.create({
      data: {
        tenantId: tenant.id,
        actorId: admin.id,
        entityType: "Project",
        entityId: project.id,
        action: "SEEDED",
        afterJson: JSON.stringify({ mode: project.mode, stage: project.stage }),
        source: "prisma-seed",
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
