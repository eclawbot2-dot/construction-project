# Pass 7 Audit — Deep Cross-Cutting Review (Business / UI / Workflow / Efficiency / Capability)

**Date:** 2026-05-01
**Method:** Four parallel deep-dive audits (business/domain, UI/UX, workflow & RBAC, performance & architecture) followed by synthesis.
**Posture vs Pass 6:** Pass 6 declared "substantially expanded MVP foundation, not yet full enterprise completion." Pass 7 confirms the schema has grown significantly beyond Pass 6's reckoning (78 models, 93 route handlers, 113 pages), but also surfaces deeper systemic issues — most importantly, **no real authentication exists** despite the app having every other appearance of a production system.

---

## 0. Executive summary

Pass 7's bottom line: the platform has impressive **breadth** but dangerous **depth gaps** that block any path to production. Three issue classes dominate:

1. **Trust boundary is missing.** No real auth; tenant and actor identity come from unsigned client cookies. Combined with patchy server-side role enforcement and no object-level permissions, the system has no defensible security perimeter.
2. **Several workflow promises are decorative.** The schema models WorkflowRun / Approval / NotificationRule / AlertEvent, but the code rarely creates Workflow runs, never delivers notifications, and only emits AuditEvents from a subset of mutation paths.
3. **The data layer is locked to SQLite** with a near-total absence of indexes and caching, while a dashboard loader fetches the entire tenant graph per request.

These are fixable, and most fixes are concentrated in 6–10 files. The "Top 10 Priorities" at the end of this doc is the recommended PR sequence.

---

## 1. CRITICAL — must fix before any external user touches this

### 1.1 No authentication exists
- **Evidence:** `src/lib/tenant.ts:7-23` (cookie `cx.tenant`, falls back to first tenant). `src/lib/permissions.ts:8-15` (`currentSuperAdmin` falls back to **first user with `superAdmin: true`** when cookie is missing — anyone hitting the site is implicitly authenticated as super-admin). `next-auth ^5.0.0-beta.30` and `@auth/prisma-adapter` are in `package.json` but no login route, no session, no password verification.
- **Impact:** Anyone with the URL has full super-admin access. Tenant cookies are unsigned, so a hostile user can switch tenants by editing the cookie.
- **Fix:** Wire NextAuth (already a dep) with credentials + future SSO. Cookies → server-validated session. `currentSuperAdmin` and `currentActor` must require an authenticated user — no fallbacks.

### 1.2 Currency stored as `Float`
- **Evidence:** `prisma/schema.prisma` — `ChangeOrder.amount`, `PayApplication.workCompletedToDate`, all currency fields use `Float @default(0)`.
- **Impact:** IEEE-754 rounding errors compound across line items. Postgres migration with `Float` retains the precision loss. Any reconciliation against accounting systems (Xero/QBO already integrated) will diverge.
- **Fix:** Migrate to `Decimal @db.Decimal(15,2)` once on Postgres. In the interim, store as string ("123.45") and parse via a typed helper.

### 1.3 Manager-role gate missing on critical mutations
- **Evidence:** `src/app/api/projects/[id]/stage/route.ts:9-20` — no `currentActor()` call; any tenant user can move a project through PRECONSTRUCTION → ACTIVE → CLOSEOUT → WARRANTY. `src/app/api/opportunities/[id]/convert/route.ts:8-33` — same pattern when converting opportunity → project.
- **Impact:** Bypasses the entire project lifecycle gating recent commit `4668b70` claimed to have implemented "across 10 modules."
- **Fix:** Wrap state-change handlers with `requireManager(tenantId)` (new helper) that calls `currentActor` and throws on `!isManager`.

### 1.4 ~15 mutation modules have no server-side role check
- **Evidence:** `bid-drafts`, `bids`, `inspections`, `imports`, `permits`, `journal`, `documents`, `qbo`, `xero`, `alerts`, `cron`, `rfp`, `inbox`, `users/invite`, `timesheets` (create), `daily-logs`, `meetings`, `budgets`, `schedules`, `warranties` — none call `currentActor()` before mutating.
- **Impact:** UI hides controls based on role, but server accepts requests from any actor. Trivial to bypass with curl.
- **Fix:** Centralize via a `requireRole(roles)` helper in `src/lib/permissions.ts` and apply to every mutation route.

### 1.5 No object-level / per-project permissions (req §10.2)
- **Evidence:** All checks use `MANAGER_ROLES`/`EDIT_ROLES` from `src/lib/permissions.ts`. No `ProjectMembership` ACL table; no query filters projects by user-project access.
- **Impact:** A manager in tenant A can see and edit **every** project in tenant A — including restricted financials, confidential bids, sealed legal items. The PRD demands restricted sharing for these.
- **Fix:** Add `ProjectAccess` model (`userId, projectId, scope: VIEW|EDIT|MANAGE`). Wrap project queries with a `whereUserCanAccess(userId)` builder.

### 1.6 Audit trail emission is incomplete
- **Evidence:** `src/lib/record-actions.ts` and `src/lib/timesheets.ts` emit `RecordComment` (audit-trail-like) for ~10 modules. Mutations in other modules (project stage, opportunity convert, qbo/xero sync, imports, alerts, bids) write **no AuditEvent and no RecordComment**. Compare `src/app/api/admin/users/[userId]/edit/route.ts:16-17` (correct pattern: emits AuditEvent with before/after) against `src/app/api/projects/[id]/stage/route.ts` (no audit emission).
- **Impact:** "Immutable audit trail for critical records" (req §6.3) fails. Discovery in litigation = problem.
- **Fix:** Centralize `withAudit(actor, op, fn)` wrapper that captures before/after JSON and writes AuditEvent. Apply to every mutation.

---

## 2. HIGH — capability gaps and architecture blockers

### 2.1 Workflow engine is decorative
- **Evidence:** `WorkflowTemplate`, `WorkflowRun`, `Approval`, `ApprovalRoute` exist in schema. Code search found **zero** `prisma.workflowRun.create(...)` calls. RecordComments are used as ad-hoc audit instead.
- **Fix:** Either implement the engine (status-change → resolve template → create WorkflowRun → spawn Approvals → emit events) or remove the decorative tables and document the manual flow.

### 2.2 Live notification delivery missing entirely
- **Evidence:** `Watcher`, `NotificationRule`, `AlertRule`, `AlertEvent` rows are created but no SMTP/push library is imported anywhere (no `nodemailer`, `resend`, `pusher`, `socket`, `sendMail`).
- **Fix:** Add Resend or Postmark. On AlertEvent insert, queue an email job. Pair with §3.1 background-job foundation.

### 2.3 Approval model stores only latest state
- **Evidence:** `Approval` in schema has single `approverId`, `status`, `createdAt`. No sequence ordering, history array, SLA timers, or delegation chain.
- **Impact:** Multi-step approval routes (req §6.4) cannot be represented faithfully. "Who already approved" requires a separate query that doesn't exist.
- **Fix:** Add `Approval.sequenceOrder`, `dueAt` (SLA), `delegatedFromId`. Store a `ApprovalEvent` log table for history.

### 2.4 SQLite hardcoded; no Postgres path
- **Evidence:** `src/lib/prisma.ts:6-7,19` uses `PrismaBetterSqlite3` with hardcoded `file:` URLs. `prisma/schema.prisma` declares `provider = "sqlite"`. README claims "Postgres-oriented schema design," but every Float/decimal/json field reflects SQLite assumptions. `prisma/dev.db` is committed (~2 MB of demo state).
- **Fix:** Switch schema to `postgresql`. Add `.env.example` with `DATABASE_URL`. Replace `db push` with proper migrations. Move dev seed out of the committed db file.

### 2.5 Five back-office modules from req §7.1A not implemented
| Module | Status |
|--------|--------|
| ATS (candidates / jobs / submissions / placements) | Missing |
| Commissions (rules, splits, accrual, payout) | Missing |
| Federal proposal capture (color teams, go/no-go, capture plans) | Missing |
| Onboarding pipeline (stage workflow + provisioning hooks) | Missing |
| Drawing / Sheet / SpecSection register (req §7.7, vertical mode high-priority) | Missing — only generic Document model |

These are listed as deferred in Pass 6 and remain so. Recommend defining one as the next vertical slice rather than half-building several.

### 2.6 Heavy-civil depth gaps
- No `CrewAssignment` model (req §7.12 — daily crew × cost code × activity). `ProductionEntry.crewName` is a free string.
- No geotagging on DailyLog, SafetyIncident, PunchItem (req §7.24 — segment/station/lat-lon).
- AI ingest (req §7.24A) for utility runs / traffic control phases not represented.

### 2.7 Mode is cosmetic, not constraint-bearing
- **Evidence:** `src/lib/dashboard.ts:85-92` filters dashboard tiles by mode. No route handler validates "only Vertical mode can create RFI" or "only Heavy-civil can create QuantityBudget." Tenant/business-unit/project mode toggles in req §8 are partially honored visually only.
- **Fix:** Add a `requireMode(project, ['VERTICAL'])` guard in mode-specific handlers; surface mode in form validation schemas.

---

## 3. HIGH — efficiency / scale

### 3.1 No background jobs / queue
- **Evidence:** No queue library (`bullmq`, `quirrel`, `inngest`, `trigger.dev`) imported. Cron route exists at `src/app/api/cron/route.ts` (recently locked down in commit `e9ca695`) but is single-shot HTTP, not a worker.
- **Impact:** Imports (`HistoricalImport`), AI runs (`AiRunLog`), notification delivery, OCR, exports all need async processing. Currently they run inline and tie up request threads.
- **Fix:** Add Inngest or BullMQ + Redis. Move imports/AI/notifications onto the queue.

### 3.2 ~40 missing indexes
- **Evidence:** Only 4 compound indexes exist in the whole `schema.prisma`. Every model with `tenantId` should have at least `@@index([tenantId])`. Hot patterns missing: `(tenantId, status)`, `(tenantId, projectId, createdAt)`, `(projectId, status)` on RFI/Submittal/ChangeOrder/Approval.
- **Impact:** SQLite tolerates this on the demo dataset; Postgres at scale won't.
- **Fix:** Audit each model for the queries that hit it; add compound indexes. Target: ~40 new index lines.

### 3.3 `dashboard.ts` loads the entire tenant graph
- **Evidence:** `src/lib/dashboard.ts:28-81` fetches all projects with ~28 nested relations 5 layers deep, then filters in memory at lines 85-106 (e.g. `project.tasks.filter(t => t.status !== "COMPLETE").length`).
- **Impact:** ~500 KB JSON per page even for a sub-tab that only needs RFI counts.
- **Fix:** Split into `getProjectSummary()` (light), `getProjectDetail(id)` (full graph only on detail page), and `getRFIs(projectId)` etc. Use Prisma `_count` with `where` for status counts instead of in-app filtering.

### 3.4 No `middleware.ts`
- **Evidence:** Missing `src/middleware.ts`. Every page resolves tenant independently via `requireTenant()`.
- **Fix:** Add middleware that resolves tenant + actor once per request, validates session, attaches to request headers, and rejects unauthenticated requests early. This is also the right place to add the auth fix from §1.1.

### 3.5 Zero `revalidatePath` / `revalidateTag` / `unstable_cache`
- **Evidence:** Codebase-wide search returns no hits. Every page re-fetches on every request.
- **Fix:** Tag-based caching: `unstable_cache` for tenant-scoped reads with tag `tenant:${id}:projects`; `revalidateTag` in mutation handlers.

### 3.6 Silent error swallowing
- **Evidence:** Multiple `catch {}` blocks (e.g. `src/app/imports/[id]/page.tsx` JSON.parse). Stale UI without warning.
- **Fix:** At minimum log; ideally surface a typed error to the user.

---

## 4. MEDIUM — UI / UX

### 4.1 `EmptyState` and `Modal` break in light mode
- **Evidence:** `src/components/ui/empty-state.tsx:13-17` uses hardcoded `bg-gray-100`/`text-gray-400`. `src/components/ui/modal.tsx:32,34` hardcodes `bg-white` and `text-[#1e3a5f]`.
- **Impact:** Recent commit `7ba8b01` fixed similar contrast on the super-admin pill but missed these. They are visible across ~5 list pages and every modal in the app.
- **Fix:** Replace with semantic tokens: `bg-card text-card-foreground`, `border-border`. Follow `src/components/layout/sidebar.tsx` pattern.

### 4.2 Form labels missing `htmlFor`
- **Evidence:** `src/app/timesheets/page.tsx:64-79, 92-110` and similar across bids/projects forms — `<label className="form-label">` without `htmlFor`, inputs without matching `id`.
- **Impact:** Screen readers don't associate label with input. Easy WCAG fix.
- **Fix:** Bulk pass adding `id`/`htmlFor` pairs.

### 4.3 Component reuse is thin (17 components for 113 pages)
- **Evidence:** `src/components/ui/` contains only `empty-state`, `modal`, `stat-tile`, `status-badge`. Heavy duplication of table markup and form layouts across feature pages.
- **Fix:** Extract a `<DataTable>` (used by ~20 list pages), a `<Form>` wrapper around react-hook-form, and a `<DetailRow label value />`. Targeted refactor; one PR per component family.

### 4.4 Required-field indicators absent
- **Evidence:** `src/components/approval-section.tsx:35-40` and other forms — `required` attribute set but no `*` and no `aria-required`. Mobile/gloved users won't know what's required.

### 4.5 Cursor-pointer rows without button semantics
- **Evidence:** `src/app/safety/page.tsx:42,69` — `cursor-pointer` on `<tr>` with nested `<Link>` (only the link is keyboard-focusable). Confuses screen readers.

### 4.6 Project status / tone color is the only cue
- **Evidence:** `src/components/ui/status-badge.tsx:16` — emerald/amber/rose color, no glyph or label fallback. Fails for color-blind users.

### 4.7 Sidebar badges hardcode rose
- **Evidence:** `src/components/layout/sidebar.tsx:108` — `border-rose-500/40 bg-rose-500/15 text-rose-200`. No theme-token mapping; risks washing out in light mode.

---

## 5. LOW — quick wins, polish

- `tsconfig.tsbuildinfo` (132 KB) is in git. `git rm --cached` it; .gitignore already has the entry.
- `prisma/dev.db` is committed. Move seed to a script-only flow.
- `lucide-react` and `date-fns` imports look tree-shakable, but no bundle audit has been run. Add `@next/bundle-analyzer` once.
- DetailShell grid: `grid gap-3 md:grid-cols-2 lg:grid-cols-3` should be `sm:grid-cols-2` for narrow phones.
- StatTile light-mode subtext at `text-slate-500` is borderline contrast.

---

## 6. Pass-6 reconciliation

| Pass-6 gap | Pass-7 finding |
|------------|----------------|
| Tenant-aware auth / SSO / MFA | **Worse than gap — no auth at all (§1.1)**. Promote to Critical. |
| ABAC-grade permission enforcement | Confirmed missing (§1.5); object-level perms required. |
| Live notification delivery | Confirmed missing (§2.2); no SMTP/push library. |
| Full commitments / change orders / owner billings / pay apps | Schema present (`ContractCommitment`, `ChangeOrder`, `PayApplication`, `LienWaiver`); approval state machines partial (PayApp has it, ContractCommitment doesn't). |
| Contracts / timesheets / invoicing / placements / ATS | Contracts ✅, TimeEntry ✅, SubInvoice ✅; **ATS still missing**, placements still missing. |
| Compliance artifact lifecycle | Schema partial (`ComplianceCheck`, `ComplianceItem`, `InsuranceCert`); lifecycle/expiry-alerts not wired. |
| GIS / map layers | Still missing (§2.6). |
| AI ingest pipeline | Schema (`AiRunLog`) and copilots present; ingest pipeline (drawing/spec parsing) still architectural only. |
| Object storage and background jobs | Both still absent (§3.1). |

Net: schema breadth has expanded materially since Pass 6, but **runtime infrastructure (auth, queue, storage, notification delivery) has not been built**, and the new mutation surface area has outgrown the role-enforcement coverage.

---

## 7. Top 10 priorities (recommended PR sequence)

Ordered by leverage. Each row is sized for a single PR.

| # | Priority | Effort | Why this order |
|---|----------|--------|----------------|
| 1 | **Wire NextAuth** with credentials + session — replace cookie fallbacks in `tenant.ts` and `permissions.ts` (§1.1) | 1–2 days | Everything else is undefended without this. |
| 2 | **Add `src/middleware.ts`** to enforce auth + resolve tenant once per request (§3.4) | 0.5 day | Required by #1; also improves #3.5. |
| 3 | **`requireRole(roles)` helper + apply to all mutation routes** (§1.3, §1.4) | 1 day | Closes the largest immediate authorization hole. |
| 4 | **`withAudit(actor, op, fn)` wrapper + retrofit ~15 routes** (§1.6) | 1 day | Fulfills req §6.3 immutable audit-trail promise. |
| 5 | **Switch Prisma to Postgres + Decimal currency types** (§1.2, §2.4) | 1 day | Unblocks scale and prevents accounting drift. |
| 6 | **Index audit (~40 compound indexes)** (§3.2) | 0.5 day | Cheap; pays off the moment you leave SQLite. |
| 7 | **Refactor `dashboard.ts` into focused loaders + add `_count` aggregations** (§3.3) | 0.5 day | 10× page-load improvement; obvious win. |
| 8 | **Implement WorkflowRun engine OR delete the schema + document manual flow** (§2.1) | 1–2 days (impl) / 1 hour (delete) | Stop pretending there's an engine. |
| 9 | **Notification delivery via Resend + queue (Inngest)** (§2.2, §3.1) | 1–2 days | Unblocks SLA, escalations, watcher promises. |
| 10 | **`<DataTable>` + `<Form>` extraction across ~20 list pages; fix EmptyState/Modal theme** (§4.1, §4.3) | 1–2 days | Largest UX win and removes copy-paste rot. |

After this sequence, the repo would move from "MVP foundation with security holes" to "security-defensible, scale-ready foundation with consistent UX."

---

## 8. What this audit did not cover

- Mobile/native client work (req §6.5, native/hybrid roadmap)
- Integration testing of QBO/Xero sync correctness
- Actual prompt quality of the AI features (45 capabilities surveyed but not depth-tested)
- Object storage migration from local FS to S3/R2
- Tenant data export/deletion (req §11.5 GDPR-style retention)

These should be in scope for Pass 8 once the Critical+High items above are closed.
