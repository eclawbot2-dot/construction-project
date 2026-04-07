# Implementation Plan

## Phase 1 - Foundation (done in this repo)
- Establish Next.js + Prisma app baseline
- Replace prior sample domain with construction domain
- Add multi-tenant schema
- Add three operating modes
- Seed representative projects for Simple / Vertical / Heavy Civil
- Build mode-aware dashboard
- Add architecture and data-model docs

## Phase 2 - Core CRUD and security
- Add authentication screens and tenant-aware session guards
- Add RBAC matrix and permission middleware
- Add CRUD flows for:
  - tenants/business units
  - projects
  - threads/messages
  - tasks
  - documents
  - RFIs
  - submittals
  - daily logs
  - budgets
  - quantity budgets
  - tickets
- Add audit logging hooks on write actions

## Phase 3 - Deeper mode packs

### Simple
- client portal lite
- change order log UI
- photo-first updates
- homeowner approvals

### Vertical
- drawing register
- spec register
- meeting minutes workflow
- commitments/change events lite
- procurement log

### Heavy civil
- equipment module
- labor entries tied to crews
- production rate forecasts
- ticket reconciliation workflows
- map/location overlays

## Phase 4 - Enterprise shared-service expansion
- CRM accounts/contacts UI
- workflow engine builder
- compliance tracking
- contracts repository
- timesheets
- invoicing integration hooks
- historical bid intelligence library
- AI bootstrap service layer

## Phase 5 - Platform hardening
- Postgres migration
- object storage
- queue workers
- async imports/exports
- SSO/SAML/OIDC
- observability and backup policy
- API and webhook surface

## Suggested immediate next backlog
1. Add auth-protected app shell and left nav
2. Build project detail page with per-mode tabs
3. Add create/edit flows for tasks, RFIs, submittals, and quantities
4. Introduce commitments/change events schema
5. Add document upload abstraction
6. Add reporting API routes
