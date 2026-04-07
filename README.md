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
npm run setup
npm run dev
```

App runs on http://localhost:3101

## Demo login users

All seeded users use password:

```text
demo1234
```

Seeded users:
- admin@construction.local
- exec@construction.local
- pm@construction.local
- super@construction.local

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
- Production should migrate to Postgres and object storage.
- This is intentionally a strong MVP foundation / vertical slice, not a fully complete Procore replacement in one commit.
