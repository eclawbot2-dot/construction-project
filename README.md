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

`AUTH_SECRET` is required (NextAuth refuses to mint sessions without
one). `AUTH_TRUST_HOST=true` lets the credentials provider work behind
the local Cloudflare tunnel; remove it for a stricter production
deployment that runs on a known public hostname.

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
