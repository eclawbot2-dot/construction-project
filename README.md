# construction-project

Enterprise multi-tenant construction management platform MVP foundation.

## What this repo now contains

A serious starter implementation for a single-codebase construction platform that supports three operating modes:

- Simple Construction Project Management
- Vertical Building Construction
- Heavy Civil Construction

The app is built as a Next.js + TypeScript + Prisma baseline with seeded demo data that shows how tenant mode, business-unit mode, and project mode can drive different behavior from one shared architecture.

## Stack

- Next.js 16
- TypeScript
- Prisma ORM
- SQLite for local prototyping
- Postgres-oriented schema design for future production promotion
- Tailwind CSS 4

## MVP foundation included

### Shared enterprise core
- Multi-tenant data model
- Business units and tenant-level configuration
- Memberships and named role templates
- Project master data
- Workflow templates / workflow runs
- Audit events
- Document registry
- Job thread / communication hub
- Tasks
- Daily logs
- Budget and budget lines

### Vertical mode starter
- RFIs
- Submittals
- Meetings
- Drawing/spec-capable document classes
- Vertical-specific dashboard defaults

### Heavy civil mode starter
- Quantity budgets
- Production entries
- Ticket tracking
- Location/segment tagging support
- Heavy-civil-specific dashboard defaults

### Simple mode starter
- Job-thread-first UX
- Lightweight tasks and budget visibility
- Client-friendly operating model defaults

## Local setup

```bash
npm install
cp .env.example .env
# generate an AUTH_SECRET into .env:
node -e "require('fs').appendFileSync('.env', 'AUTH_SECRET=' + require('crypto').randomBytes(32).toString('hex') + '\n')"
npm run setup
npm run dev
```

App runs on http://localhost:3101 — you'll be redirected to `/login`.

### Required env vars

| Var | Purpose |
| --- | --- |
| `AUTH_SECRET` | NextAuth JWT signing — required |
| `AUTH_TRUST_HOST` | `true` for local Cloudflare tunnel; remove in strict prod |
| `BCON_VAULT_KEY` | Per-tenant secret encryption salt for credentials + LLM keys |
| `CRON_SECRET` | Bearer token for `/api/cron/*` endpoints |

### Optional env vars

| Var | Purpose |
| --- | --- |
| `OPENAI_API_KEY` + `ENABLE_LLM_CALLS=true` | Platform-wide AI fallback when a tenant hasn't set their own key |
| `ANTHROPIC_API_KEY` + `ENABLE_LLM_CALLS=true` | Same as above for Claude |
| `SAM_GOV_API_KEY` | Free key from open.gsa.gov; without it, all federal scraper subscriptions fail loudly with a clear message |

## Bid pipeline (pass-12+)

The platform watches federal + SE construction procurement portals and
auto-drafts bids on listings that match each tenant's bid profile.

- 234-portal catalog (`prisma/portal-catalog*.ts`) — federal +
  AL/AR/FL/GA/KY/LA/MS/NC/SC/TN/VA/WV state procurement, DOTs, top
  counties + cities, port + transit authorities, USACE districts,
  NAVFAC SE/Mid-Atl, NASA centers, VA VISNs, AF bases, Army posts.
- 4 working scrapers in `src/lib/scrapers/` (sam-gov, generic-html,
  generic-rss, defense-news). Catalog rows that don't have a real
  scraper are explicitly marked `MANUAL` — the system never
  fabricates listings.
- `/admin/portal-coverage` shows scraper status across all 234 rows;
  weekly `/api/cron/verify-portals` refreshes URL telemetry.
- `/bids/portfolio` for BD pipeline overview;
  `/bids/listings/[id]` for full detail with score breakdown bars.

## Cron endpoints (bearer `CRON_SECRET`)

| Endpoint | Cadence | Purpose |
| --- | --- | --- |
| `/api/cron/backup` | daily | Per-tenant JSON dump + integrity check + OneDrive sync |
| `/api/cron/rfp-sweep` | daily 6× | Sweep all RfpSources, score listings, fire auto-draft |
| `/api/cron/verify-portals` | weekly | Refresh portal-coverage telemetry |
| `/api/cron/audit-prune` | monthly | Delete AuditEvent rows >365 days old (50k circuit breaker) |
| `/api/cron/alert-scan` | hourly | Generate AlertEvent rows from current state |

Register on Windows via the PowerShell scripts in `scripts/`:
`register-backup-task.ps1`, `register-portal-verify-task.ps1`.

## Customer onboarding

`docs/onboarding-checklist.md` is the playbook. Section 7 covers the
pass-12+ flow (per-tenant LLM key, bid profile, portal subscriptions,
SAM.gov key, first sweep, auto-draft policy).

## Test gates

```bash
npx tsc --noEmit             # type checks (must be 0 errors)
npx vitest run               # unit + integration tests (71 passing)
npx tsx prisma/seed-portals.ts   # idempotent catalog refresh smoke check
```

GitHub Actions CI runs all three on push/PR (`.github/workflows/ci.yml`).

## Demo login users

All seeded users use password `demo1234`:

- `admin@construction.local` — Morgan Admin (super-admin, can switch tenants and access `/admin/*`)
- `exec@construction.local` — Elena Executive
- `pm@construction.local` — Paula PM
- `super@construction.local` — Sam Superintendent

## Important files

- `prisma/schema.prisma` — core multi-tenant domain model
- `prisma/seed.ts` — demo tenant, projects, workflows, budgets, RFIs, production, tickets
- `src/lib/dashboard.ts` — aggregate data loader and mode-aware dashboard shaping
- `src/app/page.tsx` — enterprise dashboard UI with Simple / Vertical / Heavy Civil cards
- `docs/architecture.md` — implementation architecture
- `docs/data-model.md` — ERD-style model notes
- `docs/implementation-plan.md` — phased build plan

## Notes

- Local dev uses SQLite to make the repo immediately runnable.
- Production should migrate to Postgres and object storage. The header of
  `prisma/schema.prisma` and `src/lib/prisma.ts` document the required
  steps; `docs/pass-audit-07.md` §1.2 lists every Float currency field that
  must convert to Decimal in the same migration.
- This is intentionally a strong MVP foundation / vertical slice, not a
  fully complete Procore replacement in one commit.

## Audit history

`docs/pass-audit-01.md` through `pass-audit-07.md` contain the audit
trail for the platform. Pass 7 (2026-05-01) added the auth, middleware,
role guards, audit-emission, indexes, dashboard refactor, workflow
materialization, notification dispatcher, and UI theming work present
at HEAD. See pass-audit-07.md §7 for the prioritized PR sequence.
