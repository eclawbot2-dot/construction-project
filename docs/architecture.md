# Architecture

## Objective

Support one codebase that can behave like:
- a lightweight small-contractor PM tool,
- a vertical building platform,
- a heavy civil operations system,
while preserving a shared enterprise core for identity, auditability, reporting, integrations, and finance.

## Baseline architecture

### Frontend
- Next.js App Router
- Server-rendered dashboard and data loading
- Mode-aware UI composition driven from tenant/project configuration

### Backend
- Next.js server runtime for routes, server actions, and domain services
- Domain-oriented service split recommended as repo grows:
  - identity-access
  - tenant-admin
  - org-master-data
  - crm-preconstruction
  - project-core
  - communications/job-thread
  - documents
  - drawings-specs
  - technical-workflows
  - field-operations
  - labor-equipment-materials
  - production-quantities
  - financial-controls
  - quality-safety-compliance
  - reporting-analytics
  - integrations
  - automation

### Data layer
- Prisma schema with local SQLite for prototyping
- Designed for future Postgres promotion
- Tenant isolation modeled explicitly on primary entities

## Multi-tenancy model

Tenant is the top-level security and configuration boundary.

Each tenant can have:
- multiple business units,
- a default operating mode,
- enabled feature packs,
- custom terminology,
- reusable workflow templates.

Projects inherit tenant defaults but can override mode and workflow behavior.

## Mode-toggle behavior

Mode toggles are not just navigation switches. They change:
- default dashboard metrics,
- required forms,
- default workflow templates,
- preferred channels,
- terminology,
- data-entry emphasis,
- seeded modules shown in UI.

### Simple mode
Prioritizes:
- job thread,
- daily summary,
- tasks,
- client-facing communication,
- basic budget/change visibility.

### Vertical mode
Prioritizes:
- RFIs,
- submittals,
- meetings,
- document control,
- procurement / commercial controls.

### Heavy civil mode
Prioritizes:
- pay items / quantities,
- daily production,
- tickets,
- equipment/labor tracking,
- location-tagged progress.

## Security / enterprise concerns

The PRD requires:
- hard tenant isolation,
- RBAC / ABAC evolution,
- immutable audit logging,
- workflow approvals,
- integration-safe service accounts,
- export restrictions.

This MVP includes tenant-scoped entities, role templates, and audit events. Next steps should harden authorization at route/service boundaries and add permission matrices per module.

## Recommended next technical steps

1. Promote SQLite to Postgres for shared/dev/prod environments.
2. Add Auth.js + tenant-aware session enforcement on all app routes.
3. Split dashboard queries into module services.
4. Add CRUD routes and forms for Projects, Threads, RFIs, Submittals, Quantities, Tickets.
5. Add object storage abstraction for document uploads.
6. Add background jobs for imports, notifications, and AI bootstrap pipelines.
7. Add warehouse/reporting extraction layer.
