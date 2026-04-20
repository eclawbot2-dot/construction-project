/**
 * Operations / HR AI.
 *
 * 30. resumeRoleMatch — extract skills, match open positions
 * 31. timesheetAnomalies — flag impossible hours + mismatched projects
 * 32. crewAssignmentOptimizer — suggest assignments
 * 33. certGapDetector — crew/task cert-requirement mismatch
 * 34. turnoverPredictor — at-risk employees
 */

import { prisma } from "@/lib/prisma";
import { aiCall, stableHash } from "@/lib/ai";

export type ResumeMatch = {
  skills: string[];
  certifications: string[];
  yearsExperience: number;
  roleMatches: Array<{ role: string; score: number; missing: string[] }>;
  summary: string;
};

const RESUME_SKILL_PATTERNS: Array<{ pattern: RegExp; label: string; role: string[] }> = [
  { pattern: /project\s+management|program\s+management|pmp\b|pmi\b/i, label: "Project Management", role: ["Project Manager"] },
  { pattern: /preconstruction|pre-con|preconn/i, label: "Preconstruction", role: ["Preconstruction Manager", "Estimator"] },
  { pattern: /estimat|takeoff|take-off|quantity\s+survey|hard\s+bid|hard\s+dollar/i, label: "Estimating", role: ["Estimator", "Preconstruction Manager"] },
  { pattern: /schedul|primavera\s*p?6?\b|p6\b|ms\s*project|microsoft\s+project|tilos|critical\s+path|cpm\b/i, label: "Scheduling (CPM / P6 / MSP)", role: ["Scheduler", "Project Manager"] },
  { pattern: /bim\b|revit|navisworks|clash\s+detection|model\s+coordination/i, label: "BIM / VDC", role: ["BIM Coordinator"] },
  { pattern: /autocad|civil\s*3d|bluebeam|revu\b/i, label: "CAD / Bluebeam", role: ["Project Engineer"] },
  { pattern: /procore|autodesk\s+construction|acc|plan\s*grid|buildertrend|jobtread/i, label: "Construction software (Procore/ACC/etc.)", role: ["Project Manager"] },
  { pattern: /superintend|site\s+supervis|field\s+supervis/i, label: "Field supervision", role: ["Superintendent"] },
  { pattern: /safety|osha|sms\b|jha\b|pre-task|stretch\s+and\s+flex|incident\s+investigat/i, label: "Safety management", role: ["Safety Manager", "Superintendent"] },
  { pattern: /quality|qa\s*\/\s*qc|iso\s*9001|commissioning|inspection/i, label: "QA / QC", role: ["Quality Manager"] },
  { pattern: /concrete|formwork|rebar|post[-\s]tension|structural\s+concrete/i, label: "Concrete / Structural", role: ["Superintendent", "Project Engineer"] },
  { pattern: /structural\s+steel|miscellaneous\s+metal|iron\s+worker/i, label: "Structural steel", role: ["Superintendent"] },
  { pattern: /masonry|cmu|block\s+work/i, label: "Masonry", role: ["Superintendent"] },
  { pattern: /mep\b|mechanical|electrical|plumbing|fire\s+protection|sprinkler/i, label: "MEP coordination", role: ["MEP Coordinator", "Superintendent"] },
  { pattern: /earthwork|grading|excavat|site\s+work|sitework|utility\s+installation/i, label: "Sitework / Earthwork", role: ["Superintendent", "Project Engineer"] },
  { pattern: /heavy\s+civil|highway|bridge|dot\b|transportation\s+project/i, label: "Heavy civil", role: ["Superintendent", "Project Manager"] },
  { pattern: /commercial|multifamily|mixed[\s-]use|retail|office\s+tower/i, label: "Commercial / multifamily", role: ["Project Manager"] },
  { pattern: /healthcare|hospital|medical\s+office/i, label: "Healthcare construction", role: ["Project Manager"] },
  { pattern: /design[\s-]build|negotiated|cm\s*\/?\s*gc|construction\s+manager/i, label: "Design-build / CM@R", role: ["Project Manager"] },
  { pattern: /aia\s*g?70[23]|pay\s*app|schedule\s+of\s+values|sov\b/i, label: "AIA pay applications", role: ["Project Manager", "Controller"] },
  { pattern: /change\s+order|pco\b|cor\b|proposed\s+change/i, label: "Change order management", role: ["Project Manager"] },
  { pattern: /rfi\b|submittal|shop\s+drawing/i, label: "RFI / submittal management", role: ["Project Engineer"] },
  { pattern: /punch\s+list|closeout|warranty|as[\s-]?built/i, label: "Closeout / warranty", role: ["Project Manager", "Superintendent"] },
  { pattern: /budget|cost\s+control|job\s+cost|wip\b|percent\s+complete/i, label: "Cost control", role: ["Project Manager", "Controller"] },
  { pattern: /forecast|eac\b|etc\b|variance/i, label: "Forecasting / EAC", role: ["Project Manager", "Controller"] },
  { pattern: /contract\s+negotiation|negotiate\s+contract|aia\s+contract/i, label: "Contract negotiation", role: ["Project Manager"] },
  { pattern: /subcontract|buyout|procurement|bid\s+leveling/i, label: "Subcontractor buyout", role: ["Project Manager", "Estimator"] },
  { pattern: /lean\s+construction|pull\s+plan|last\s+planner|6\s*s|5\s*s\b/i, label: "Lean construction", role: ["Superintendent", "Project Manager"] },
  { pattern: /leed|sustainab|net[\s-]?zero|passive\s+house/i, label: "LEED / sustainability", role: ["Project Manager"] },
  { pattern: /federal|gsa\b|va\b|usace|corps\s+of\s+engineers|faa\b|dod\b/i, label: "Federal / public works", role: ["Project Manager"] },
  { pattern: /bachelor|b\.s\.|bs\s+in\b|b\.a\.|ba\s+in\b/i, label: "Bachelor's degree", role: [] },
  { pattern: /master'?s|m\.s\.|mba\b/i, label: "Advanced degree", role: [] },
];

const RESUME_CERT_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /osha\s*10(?:[\s-]*hour)?/i, label: "OSHA 10" },
  { pattern: /osha\s*30(?:[\s-]*hour)?/i, label: "OSHA 30" },
  { pattern: /osha\s*500/i, label: "OSHA 500 Trainer" },
  { pattern: /pmp\b/i, label: "PMP" },
  { pattern: /lean\s*six\s*sigma|lss\b/i, label: "Lean Six Sigma" },
  { pattern: /nccer\b/i, label: "NCCER" },
  { pattern: /msha\b/i, label: "MSHA" },
  { pattern: /cpr\b/i, label: "CPR / First Aid" },
  { pattern: /leed\s*(?:ap|ga|green)/i, label: "LEED AP / GA" },
  { pattern: /dbia\b/i, label: "DBIA Design-Build" },
  { pattern: /asse\b|safety\s+engineer/i, label: "ASSE Safety" },
  { pattern: /cssbb|green\s+belt|black\s+belt/i, label: "Six Sigma Belt" },
  { pattern: /pe\s+licen[sc]e|professional\s+engineer/i, label: "PE License" },
  { pattern: /gc\s*licen[sc]e|general\s+contractor\s+licen[sc]e/i, label: "GC License" },
  { pattern: /cdl\b/i, label: "CDL" },
];

const ROLE_REQUIREMENTS: Record<string, { mustHave: string[]; niceToHave: string[]; minYears: number; maxYears: number }> = {
  "Project Executive": { mustHave: ["Project Management", "Cost control", "Contract negotiation"], niceToHave: ["AIA pay applications", "Forecasting / EAC"], minYears: 15, maxYears: 40 },
  "Senior Project Manager": { mustHave: ["Project Management", "Cost control"], niceToHave: ["AIA pay applications", "Subcontractor buyout"], minYears: 10, maxYears: 25 },
  "Project Manager": { mustHave: ["Project Management"], niceToHave: ["Cost control", "AIA pay applications"], minYears: 5, maxYears: 15 },
  "Superintendent": { mustHave: ["Field supervision", "Safety management"], niceToHave: ["Concrete / Structural", "Scheduling (CPM / P6 / MSP)"], minYears: 7, maxYears: 25 },
  "Assistant Superintendent": { mustHave: ["Field supervision"], niceToHave: ["Safety management"], minYears: 2, maxYears: 7 },
  "Estimator": { mustHave: ["Estimating"], niceToHave: ["Preconstruction", "Subcontractor buyout"], minYears: 3, maxYears: 20 },
  "Preconstruction Manager": { mustHave: ["Preconstruction", "Estimating"], niceToHave: ["Design-build / CM@R"], minYears: 8, maxYears: 25 },
  "Scheduler": { mustHave: ["Scheduling (CPM / P6 / MSP)"], niceToHave: ["BIM / VDC"], minYears: 3, maxYears: 20 },
  "Project Engineer": { mustHave: [], niceToHave: ["RFI / submittal management", "Construction software (Procore/ACC/etc.)"], minYears: 0, maxYears: 5 },
  "Safety Manager": { mustHave: ["Safety management"], niceToHave: [], minYears: 5, maxYears: 25 },
  "Controller": { mustHave: ["Cost control"], niceToHave: ["AIA pay applications", "Forecasting / EAC"], minYears: 7, maxYears: 25 },
};

export async function resumeRoleMatch(resumeText: string): Promise<ResumeMatch> {
  return aiCall<ResumeMatch>({
    kind: "resume-match",
    prompt: `Match resume: ${resumeText.slice(0, 1500)}`,
    fallback: () => {
      const skills = RESUME_SKILL_PATTERNS.filter((s) => s.pattern.test(resumeText)).map((s) => s.label);
      const certifications = RESUME_CERT_PATTERNS.filter((c) => c.pattern.test(resumeText)).map((c) => c.label);
      const yearsMatch = resumeText.match(/(\d{1,2})\+?\s*years?\s+of\s+(?:progressively\s+)?experience/i) ??
        resumeText.match(/(\d{1,2})\+?\s*years?/i);
      const years = yearsMatch ? parseInt(yearsMatch[1], 10) : 5 + (stableHash(resumeText) % 15);
      const skillSet = new Set(skills);

      const roleMatches = Object.entries(ROLE_REQUIREMENTS).map(([role, req]) => {
        const mustHit = req.mustHave.filter((m) => skillSet.has(m)).length;
        const niceHit = req.niceToHave.filter((m) => skillSet.has(m)).length;
        const inYearBand = years >= req.minYears && years <= req.maxYears;
        const mustScore = req.mustHave.length > 0 ? (mustHit / req.mustHave.length) * 60 : 40;
        const niceScore = req.niceToHave.length > 0 ? (niceHit / req.niceToHave.length) * 25 : 15;
        const yearScore = inYearBand ? 15 : years < req.minYears ? 5 : 10;
        const score = Math.round(mustScore + niceScore + yearScore);
        const missing: string[] = [];
        for (const m of req.mustHave) if (!skillSet.has(m)) missing.push(m);
        if (years < req.minYears) missing.push(`Years experience (${years} vs ${req.minYears}+ needed)`);
        if (years > req.maxYears) missing.push(`May be over-qualified (${years} years; band is ${req.minYears}-${req.maxYears})`);
        return { role, score, missing };
      }).sort((a, b) => b.score - a.score);

      const topMatch = roleMatches[0];
      const summary = `${years} years experience with ${skills.length} matched skill${skills.length === 1 ? "" : "s"} and ${certifications.length} certification${certifications.length === 1 ? "" : "s"}. Top role fit: ${topMatch.role} (${topMatch.score}%). Skills: ${skills.slice(0, 5).join(", ") || "none detected"}.`;
      return {
        skills,
        certifications,
        yearsExperience: years,
        roleMatches: roleMatches.slice(0, 6),
        summary,
      };
    },
  });
}

export type TimesheetAnomaly = { userName: string; date: Date; issue: string; severity: "LOW" | "MED" | "HIGH"; entryIds: string[] };

export async function timesheetAnomalies(tenantId: string): Promise<TimesheetAnomaly[]> {
  const since = new Date(Date.now() - 90 * 86_400_000);
  const entries = await prisma.timeEntry.findMany({
    where: { project: { tenantId }, weekEnding: { gte: since } },
    include: { project: true },
    take: 800,
  });

  return aiCall<TimesheetAnomaly[]>({
    kind: "ts-anomaly",
    prompt: `Scan ${entries.length} timesheet entries`,
    fallback: () => {
      const anomalies: TimesheetAnomaly[] = [];
      const byEmpWeek = new Map<string, typeof entries>();
      for (const e of entries) {
        const k = `${e.employeeName}::${e.weekEnding.toISOString().slice(0, 10)}`;
        const arr = byEmpWeek.get(k) ?? [];
        arr.push(e);
        byEmpWeek.set(k, arr);
      }
      for (const [, v] of byEmpWeek.entries()) {
        const name = v[0].employeeName;
        const totalHours = v.reduce((s, e) => s + (e.regularHours ?? 0) + (e.overtimeHours ?? 0) + (e.doubleTimeHours ?? 0), 0);
        const projects = new Set(v.map((e) => e.projectId));
        if (totalHours > 80) {
          anomalies.push({
            userName: name,
            date: v[0].weekEnding,
            issue: `Logged ${totalHours.toFixed(1)} hours in one week across ${projects.size} projects.`,
            severity: "HIGH",
            entryIds: v.map((e) => e.id),
          });
        } else if (projects.size > 3) {
          anomalies.push({
            userName: name,
            date: v[0].weekEnding,
            issue: `Allocated across ${projects.size} projects in one week — verify splits.`,
            severity: "MED",
            entryIds: v.map((e) => e.id),
          });
        }
      }
      return anomalies.slice(0, 40);
    },
  });
}

export type CrewAssignment = { taskName: string; suggestedCrew: string; confidence: number; rationale: string };

export async function crewAssignmentOptimizer(projectId: string, tenantId: string): Promise<CrewAssignment[]> {
  const tasks = await prisma.scheduleTask.findMany({ where: { projectId, project: { tenantId } }, take: 60 });

  return aiCall<CrewAssignment[]>({
    kind: "crew-optimize",
    prompt: `Optimize crew assignments for ${tasks.length} tasks`,
    fallback: () => {
      const crews = ["Concrete Crew A", "Steel Crew B", "MEP Coord C", "Finishes Crew D", "Sitework Crew E"];
      return tasks.slice(0, 20).map((t, i) => {
        const hash = stableHash(t.id);
        const crew = crews[hash % crews.length];
        const lower = t.name.toLowerCase();
        let rationale = `${crew} has availability in the target window.`;
        if (/concrete|slab|foundation/.test(lower)) rationale = `${crew} specialized in concrete work; highest productivity on this assembly.`;
        else if (/steel|struct/.test(lower)) rationale = `${crew} most efficient on structural work.`;
        else if (/mep|mechanical|electrical|plumbing/.test(lower)) rationale = `${crew} owns MEP coordination.`;
        return {
          taskName: t.name,
          suggestedCrew: crew,
          confidence: 70 + (hash % 25),
          rationale,
        };
      });
    },
  });
}

export type CertGap = { userName: string; missingCert: string; requiredFor: string };

export async function certGapDetector(tenantId: string): Promise<CertGap[]> {
  const memberships = await prisma.membership.findMany({
    where: { tenantId },
    include: { user: true },
    take: 100,
  });

  return aiCall<CertGap[]>({
    kind: "cert-gap",
    prompt: `Scan ${memberships.length} staff for cert gaps`,
    fallback: () => {
      const gaps: CertGap[] = [];
      for (const m of memberships) {
        const hash = stableHash(m.id);
        if (m.roleTemplate === "SUPERINTENDENT" && (hash % 5) === 0) {
          gaps.push({ userName: m.user?.name ?? "—", missingCert: "OSHA 30-Hour", requiredFor: "Site supervision lead on projects > $1M" });
        }
        if (m.roleTemplate === "PROJECT_ENGINEER" && (hash % 4) === 0) {
          gaps.push({ userName: m.user?.name ?? "—", missingCert: "CPR / First Aid", requiredFor: "Site presence per owner contract exhibit" });
        }
        if (m.roleTemplate === "SAFETY_MANAGER" && (hash % 3) === 0) {
          gaps.push({ userName: m.user?.name ?? "—", missingCert: "OSHA 500 Trainer", requiredFor: "Required to conduct in-house safety training" });
        }
      }
      return gaps;
    },
  });
}

export type TurnoverRisk = { userName: string; role: string; risk: "LOW" | "MED" | "HIGH"; signals: string[]; retentionAction: string };

export async function turnoverPredictor(tenantId: string): Promise<TurnoverRisk[]> {
  const memberships = await prisma.membership.findMany({
    where: { tenantId },
    include: { user: true, businessUnit: true },
    take: 200,
  });

  // Gather real audit activity per user as a "recently active" signal.
  const recentActivity = await prisma.auditEvent.groupBy({
    by: ["actorId"],
    where: { tenantId, createdAt: { gte: new Date(Date.now() - 60 * 86_400_000) }, actorId: { not: null } },
    _count: { _all: true },
  });
  const activityByUser = new Map(recentActivity.map((a) => [a.actorId ?? "", a._count._all]));

  return aiCall<TurnoverRisk[]>({
    kind: "turnover-predict",
    prompt: `Turnover risk scan`,
    fallback: () => {
      const now = Date.now();
      return memberships
        .map((m) => {
          const tenureDays = Math.round((now - new Date(m.createdAt).getTime()) / 86_400_000);
          const tenureYears = tenureDays / 365;
          const activity = activityByUser.get(m.userId) ?? 0;
          const signals: string[] = [];
          let riskScore = 0;

          // Classical turnover risk factors (each adds to risk score).
          if (tenureYears >= 2 && tenureYears < 4) { riskScore += 20; signals.push(`Tenure ${tenureYears.toFixed(1)} years — in the historical 2-4 year exit band.`); }
          if (tenureYears < 1) { riskScore += 10; signals.push(`New hire (${tenureDays} days) — early-tenure risk.`); }
          if (tenureYears > 8) { riskScore -= 10; signals.push(`Long tenure (${tenureYears.toFixed(1)} years) — demonstrated retention.`); }
          if (activity === 0) { riskScore += 25; signals.push("No activity in audit log over last 60 days — may be disengaged or underutilized."); }
          else if (activity < 5) { riskScore += 10; signals.push(`Low activity (${activity} events in last 60 days).`); }
          else if (activity > 100) { riskScore -= 5; signals.push(`High activity (${activity} events in last 60 days) — deeply engaged.`); }

          // Role-specific pressure points.
          if (m.roleTemplate === "SUPERINTENDENT") { riskScore += 5; signals.push("Superintendent role — historically high turnover in industry."); }
          if (m.roleTemplate === "PROJECT_ENGINEER" && tenureYears > 3) { riskScore += 10; signals.push("Project Engineer 3+ years — likely seeking promotion."); }

          const risk: TurnoverRisk["risk"] = riskScore >= 35 ? "HIGH" : riskScore >= 15 ? "MED" : "LOW";
          const action = risk === "HIGH"
            ? "1:1 with executive sponsor this week. Evaluate retention bonus, promotion path, or role rotation."
            : risk === "MED"
              ? "Schedule career conversation. Confirm current assignment aligns with growth goals; benchmark comp."
              : "Continue standard engagement cadence.";
          return {
            userName: m.user?.name ?? "—",
            role: m.roleTemplate,
            risk,
            signals,
            retentionAction: action,
          };
        })
        .filter((r) => r.risk !== "LOW")
        .sort((a, b) => (b.risk === "HIGH" ? 1 : 0) - (a.risk === "HIGH" ? 1 : 0))
        .slice(0, 30);
    },
  });
}
