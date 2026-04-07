# Enterprise Multi-Tenant Construction Management Platform Requirements

**Repository:** eclawbot2-dot/construction-project  
**Prepared for:** E  
**Date:** 2026-04-07  
**Document type:** Product Requirements Document (PRD) / Requirements Sweep / Enterprise Scope Definition

---

## 1. Executive Summary

This document defines the requirements for an enterprise-grade, multi-tenant construction management software platform that can operate in three product modes from a single codebase:

1. **Simple Construction Project Management** — lightweight operations for small general contractors, remodelers, specialty trades, and owner-led projects; includes a streamlined "job thread" operating model.
2. **Vertical Building Construction** — a Procore-class operating model for commercial buildings, multifamily, hospitality, institutional, mixed-use, tenant improvement, and large GC/subcontractor coordination.
3. **Heavy Civil Construction** — workflows for roads, bridges, utilities, sitework, earthwork, concrete, paving, pipe, infrastructure, DOT/public works, self-perform operations, equipment-centric planning, production, and field tracking.

The platform must support all three modes as configurable operating models, not separate products. The core architecture must remain multi-tenant, role-secure, configurable by tenant, and extensible by market segment.

The system should allow a tenant to:
- choose a primary operating mode at tenant setup,
- enable secondary modules later,
- run multiple business units with different default workflows,
- preserve shared master data, finance, identity, security, reporting, and integration layers.

---

## 2. Product Vision

Build a single enterprise platform that can serve:
- a small builder needing easy task coordination,
- a commercial GC needing document control, RFIs, submittals, meetings, and financial controls,
- a heavy civil contractor needing production tracking, cost codes, quantities, daily reports, equipment, crews, tickets, and progress-installed measurements.

The product must feel:
- **simple** when configured for small teams,
- **disciplined and document-heavy** for vertical building,
- **operations and production-centric** for heavy civil,
- **enterprise-safe** across all modes.

---

## 3. Goals

### 3.1 Business Goals
- Support multi-tenant SaaS deployment and private/single-tenant enterprise deployment.
- Capture the majority of workflows found across lightweight PM tools, Procore-like commercial construction platforms, and heavy civil operations platforms.
- Allow feature packaging by tenant tier, business line, and geography.
- Reduce code forks by using configuration, permissions, workflow templates, and mode packs.
- Create a foundation for future AI-assisted project controls, forecasting, document intelligence, and field automation.

### 3.2 Product Goals
- Establish a common data model across tenants and project types.
- Provide configurable workflows by segment.
- Support mobile-first field execution and desktop-heavy office administration.
- Deliver auditability, approvals, compliance, and reporting.
- Support integrations with accounting, storage, ERP, BIM, scheduling, mapping, equipment telematics, and payroll systems.

### 3.3 Technical Goals
- Use a modular architecture with clean domain boundaries.
- Enforce tenant isolation and robust RBAC/ABAC.
- Maintain complete audit logs for regulated/high-risk workflows.
- Support document-heavy storage and versioning.
- Support event-driven automation and integration webhooks.

---

## 4. Non-Goals for Initial Version

These may be roadmap items, but are not required for v1 launch:
- Full 4D/5D BIM authoring tools.
- Native CAD editing.
- Full ERP replacement.
- Native payroll engine for all jurisdictions.
- Marketplace ecosystem at launch.
- Full drone photogrammetry processing pipeline.

---

## 5. Operating Modes

## 5.1 Simple Construction Project Management Mode

Target users:
- small GCs,
- custom home builders,
- residential remodelers,
- specialty contractors,
- owner’s reps,
- design-build small teams.

Primary emphasis:
- easy project setup,
- job-level communication,
- tasks and responsibility tracking,
- document/photo sharing,
- budget awareness,
- change tracking,
- customer-friendly updates.

Defining concept:
- **Job Thread** = one central communication and activity stream per job, with optional subthreads by topic.

Key capability requirements:
- project/job setup in minutes,
- contact directory,
- job thread with comments, mentions, photos, files, approvals, decisions, and pinned items,
- task lists and checklists,
- milestones and due dates,
- estimate-to-job conversion,
- simple budget and committed cost tracking,
- change order log,
- punch list / issue tracking,
- homeowner/client portal,
- daily log / daily summary,
- mobile photo capture and annotated updates,
- simple invoicing/export readiness.

## 5.2 Vertical Building Mode

Target users:
- commercial GCs,
- large subcontractors,
- owners/developers,
- owner reps,
- construction managers,
- project engineers,
- superintendents,
- VDC/document control teams.

Primary emphasis:
- document control,
- formal workflows,
- RFIs,
- submittals,
- transmittals,
- drawings/specs,
- meetings,
- inspections,
- quality and safety,
- cost and commitment controls,
- schedule coordination,
- subcontractor collaboration,
- historical bid intelligence,
- AI-assisted project startup.

Defining benchmark:
- **Procore-class workflow coverage** without blindly copying UI or data structures.

Key capability requirements:
- drawing and specification management,
- controlled document distribution,
- RFIs,
- submittals,
- meeting minutes,
- correspondence,
- punch/observations,
- inspections and quality workflows,
- safety incidents and toolbox talks,
- commitments, pay apps, owner billings, prime contract, budget transfers,
- change events / change orders / PCCOs / owner CORs,
- daily logs and manpower tracking,
- directory and granular permissions,
- schedule imports and look-ahead planning,
- procurement and long lead tracking,
- closeout and turnover,
- warranty workflows,
- historical bid/estimate library,
- trade/vendor quote history,
- conceptual estimating intelligence by building type,
- AI-assisted project ingest from plans/specs/addenda/contracts.

## 5.3 Heavy Civil Mode

Target users:
- heavy civil contractors,
- sitework and utility contractors,
- road and bridge contractors,
- grading/earthwork contractors,
- paving contractors,
- public works contractors,
- self-perform concrete contractors,
- infrastructure project controls teams.

Primary emphasis:
- production, quantities, crew/equipment planning, field tickets, installed quantities, productivity, unit cost control, materials, trucking, utility tracking, survey/GIS context, owner/compliance reporting,
- historical bid and production intelligence,
- AI-assisted project startup and field structure generation.

Defining benchmark:
- combine project management with self-perform field production and cost control.

Key capability requirements:
- bid item / pay item structure,
- cost codes, phases, bid schedule mapping,
- quantities budgeted vs installed vs earned,
- daily production tracking by crew and activity,
- equipment assignments and utilization,
- trucking/hauling tickets,
- materials received/consumed,
- production rates and forecast-to-complete,
- field diary and weather,
- force account / T&M tracking,
- owner quantity backup,
- DOT / municipal compliance workflows,
- utility segment tracking,
- map/location-aware progress,
- subcontractor and self-perform hybrid workflows,
- change tickets, claims support, and as-built evidence capture,
- historical bid item and unit-cost intelligence,
- historical production-rate intelligence,
- AI-assisted project ingest from plans, bid schedules, specifications, utility sheets, and owner contract documents.

---

## 6. Common Cross-Mode Requirements

The following are required regardless of mode.

### 6.1 Multi-Tenancy
- Hard tenant isolation for application data.
- Tenant-aware authentication and authorization.
- Tenant-specific branding, domains, notification templates, and feature flags.
- Tenant configuration for terminology (e.g. project/job/work order, RFI vs question, observation vs issue).
- Tenant-specific workflow templates and status models.
- Support for:
  - single company tenant,
  - multi-business-unit tenant,
  - GC + self-perform divisions,
  - owner/portfolio tenants,
  - franchise/group structures.

### 6.2 Identity and Access
- SSO/SAML/OIDC support.
- Username/password + MFA.
- External collaborator access.
- Role-based and attribute-based access control.
- Project-level, company-level, and module-level permissions.
- Restricted sharing for confidential financial/legal items.
- Delegated admin and service accounts for integrations.

### 6.3 Auditability
- Immutable audit trail for critical records.
- Field history for status changes, approvals, assignments, due dates, budget changes, document revisions, and financial events.
- Exportable audit logs.
- Legal hold / retention policy support.

### 6.4 Notifications and Workflow
- In-app, email, SMS/push optional.
- Mentioning, watcher/subscriber models.
- Escalation rules.
- Approval routing engine.
- Reminder and SLA engine.
- Digest options by role.

### 6.5 Mobile and Offline
- Responsive web app and native/hybrid mobile support roadmap.
- Field-first workflows.
- Offline capture for photos, logs, checklists, tickets, and signatures.
- Sync conflict handling.

### 6.6 Reporting and Analytics
- Real-time dashboards.
- Cross-project rollups.
- Portfolio analytics.
- Export to CSV/XLSX/PDF.
- Scheduled reports.
- API access to reporting warehouse.

### 6.7 Integrations
- Accounting/ERP: QuickBooks, Sage, Viewpoint, CMiC, Acumatica, NetSuite, Foundation, Spectrum, JD Edwards, SAP (roadmap by tier).
- Storage: Google Drive, OneDrive, SharePoint, Dropbox, Box.
- Scheduling: Primavera P6, Microsoft Project, Asta, CSV/XER import.
- BIM/doc tools: Autodesk Construction Cloud, Revit metadata ingestion, Bluebeam links.
- Field: GPS, telematics, equipment systems, weather data, drone/photo feeds.
- Messaging: email ingestion, calendar integration, Slack/Teams optional.
- Public sector/compliance: certified payroll and agency exports where applicable.

---

## 7. Functional Requirements by Domain

## 7.1 Tenant and Organization Management
- Create and manage tenants.
- Support parent/subsidiary business units.
- Support divisions by geography, market, or service line.
- Configure default mode by tenant and override by project.
- Configure default cost structure, naming conventions, fiscal calendars, reporting calendars, and approval chains.
- Manage office locations, yards, warehouses, and regions.

## 7.1A Enterprise Shared Back-Office and Workforce Operations
These requirements must exist as shared enterprise services across the platform, even when some tenants enable them progressively.

Required module coverage:
- CRM (accounts, contacts)
- ATS (candidates, jobs, submissions)
- placements
- timesheets
- invoicing
- contracts
- commissions
- compliance tracking
- federal proposal capture
- onboarding pipeline
- workflow engine
- audit logging

### CRM Requirements
- account management for owners, clients, agencies, vendors, subcontractors, consultants, and partners,
- contact management with role history and relationship mapping,
- activity tracking, notes, attachments, tasks, and opportunity linkage,
- account hierarchies and parent/child structures,
- account segmentation by market, region, contract vehicle, customer type, and strategic importance.

### ATS / Recruiting / Staffing Requirements
- candidate profiles,
- job requisitions,
- submissions,
- interview pipeline,
- offer tracking,
- hiring/onboarding coordination,
- recruiter and coordinator workflows,
- internal/external notes,
- resume/document management,
- placement records,
- recruiter activity metrics.

### Placements / Workforce Deployment Requirements
- placement records tied to project, contract, labor category, department, or role,
- assignment start/end dates,
- bill/pay rate structures where applicable,
- extension/renewal tracking,
- redeployment pipeline,
- placement performance and status.

### Timesheets Requirements
- timesheet capture by employee/worker/project/cost code/task,
- approval routing,
- corrections/re-submissions,
- integration hooks to payroll/accounting,
- certified payroll support roadmap,
- field/mobile entry and supervisor approval.

### Invoicing Requirements
- customer invoicing,
- project billing,
- milestone/T&M/progress billing models,
- invoice status and aging,
- integration/export to accounting,
- supporting backup attachment.

### Contracts Requirements
- contract repository,
- contract type classification,
- renewal/expiration tracking,
- obligations and deliverables tracking,
- linked approvals,
- linkage to projects, vendors, placements, and proposals.

### Commissions Requirements
- commission rule configuration,
- split handling,
- calculation engine,
- accrual and payout tracking,
- auditability and overrides with approval.

### Compliance Tracking Requirements
- insurance certificates,
- licenses,
- training/certifications,
- background checks where enabled,
- contract compliance,
- document expiry alerts,
- federal/state/local compliance artifact tracking.

### Federal Proposal Capture Requirements
- opportunity/capture records,
- contract vehicle tracking,
- agency/customer intelligence,
- teaming/partner tracking,
- proposal calendar and milestones,
- capture plans,
- color-team review workflow,
- document repository,
- go/no-go approvals,
- pricing/proposal coordination.

### Onboarding Pipeline Requirements
- stage-based onboarding workflow,
- document collection,
- task orchestration,
- approvals,
- equipment/access provisioning hooks,
- orientation/training tracking,
- compliance pre-start checks.

### Workflow Engine Requirements
- configurable event/condition/action automation,
- approvals,
- escalations,
- reminders,
- status transitions,
- SLA timing,
- reusable workflow templates,
- cross-module triggers.

### Audit Logging Requirements
- system-wide immutable audit events for critical objects,
- actor, timestamp, before/after values, source, and approval evidence,
- export/search/filter tools,
- retention controls and legal hold support.

## 7.2 CRM / Opportunity / Preconstruction
- Leads and opportunities.
- Estimate/bid tracking.
- Contacts, clients, owners, architects, engineers, vendors, subs.
- Proposal generation.
- Bid package distribution.
- Preconstruction checklist.
- Document repository for plans/specs/addenda.
- Bid leveling / subcontractor comparison.
- Scope sheets.
- Risk flags and qualifications/exclusions.
- Convert awarded opportunity into project with carry-forward data.

Mode-specific emphasis:
- **Simple:** estimate to job conversion, customer proposal acceptance, deposit tracking.
- **Vertical:** bid packages, bid leveling, scope gaps, procurement log, historical estimate assemblies, trade quote history, conceptual pricing by building/program type.
- **Heavy civil:** bid items, quantity takeoff references, production assumptions, crew/equipment assumptions, subcontract quote leveling, historical unit prices, historical production rates, geography/owner-adjusted bid history.

### 7.2A Historical Bid Intelligence and Estimating Memory
High priority for Vertical and Heavy Civil; optional/light for Simple.

Required capabilities:
- centralized historical bid library across awarded and non-awarded opportunities,
- estimate version history and comparison,
- line-item history by cost code, bid item, assembly, trade, scope package, and vendor,
- normalization of historical bids by date, geography, market conditions, customer/owner type, project type, and delivery method,
- estimate vs actual feedback loop using final cost, production, and change history,
- subcontractor/vendor quote history with response rates, pricing trends, exclusions, qualifications, and award results,
- win/loss analytics,
- benchmarking by building type, asset class, utility type, civil scope, and customer segment,
- unit-cost history with confidence ranges,
- production-rate history tied to actual field outcomes,
- search and AI query interface over historical bids and estimates,
- ability to clone prior estimates/projects as a starting point,
- pattern detection for scope gaps, pricing outliers, missed alternates, and recurring change exposure.

AI requirements for this domain:
- recommend estimate assemblies and cost codes from uploaded plans/specs,
- propose vendor/subcontractor invite lists based on historical relevance,
- surface similar past jobs and pricing benchmarks,
- predict risk areas and likely scope gaps,
- generate a first-pass conceptual estimate framework for human review.

## 7.3 Project Setup and Master Data
- Project record with codes, address, owner, contract type, segment, schedule, value, margin target.
- Template-based creation.
- Phase/cost code setup.
- Contract values and alternate scopes.
- Tenant-specific default forms and workflows.
- Integration-ready external IDs.
- Support for multiple project structures:
  - simple phases,
  - CSI divisions,
  - self-perform cost codes,
  - owner pay items,
  - WBS hierarchy.

## 7.4 Job Thread / Communication Hub

Required especially for the Simple mode, but useful platform-wide.

- Each project must have a default **Job Thread**.
- Support topic channels/subthreads:
  - general,
  - schedule,
  - budget,
  - owner,
  - field,
  - safety,
  - procurement,
  - closeout.
- Messages support mentions, attachments, inline approvals, reactions, decisions, and resolution marking.
- Convert thread items into tasks, RFIs, issues, submittals, commitments, change requests, and meeting agenda items.
- Thread entries should be filterable by type, author, date, tag, company, and linked object.
- Email forwarding into thread.
- Voice note / photo update support on mobile.
- Pinned decisions log.
- Read receipts configurable by tenant.
- External participant controls.

## 7.5 Tasks, Workflows, and Checklists
- Task management with assignments, due dates, dependencies, priorities, tags.
- Checklist templates by project type.
- Recurring tasks.
- Workflow state transitions and approvals.
- SLA timers.
- Auto-generated tasks from project stage templates.
- Bulk update tools.

Mode-specific examples:
- **Simple:** homeowner selections, permit follow-up, finish schedule, punch completion.
- **Vertical:** procurement milestones, submittal review cycles, closeout matrix.
- **Heavy civil:** traffic control setup, utility locate tasks, pour prep, trucking coordination, erosion control checks.

## 7.6 Document Management and Control
- Central document repository.
- Foldering + metadata tagging.
- Version control.
- Check-in/check-out optional.
- Markups and annotation support roadmap; baseline supports linked markup files.
- Controlled distribution lists.
- OCR and document classification roadmap.
- Permissions by folder/document/classification.
- Transmittal support.
- Retention rules.
- Bulk upload and email ingestion.

Required document classes:
- contracts,
- drawings,
- specs,
- permits,
- RFIs,
- submittals,
- meeting minutes,
- daily reports,
- photos/videos,
- safety docs,
- quality docs,
- invoices/pay apps,
- change documents,
- closeout docs,
- warranties,
- test reports,
- tickets.

## 7.7 Drawing / Plan / Specification Management
- Upload and version drawing sets.
- Sheet register.
- Discipline classification.
- Revision history.
- Links from drawings to RFIs, submittals, punch items, photos, and as-builts.
- Spec section register.
- Drawing distribution and current-set enforcement.

Mode notes:
- **Vertical:** mandatory, high priority.
- **Heavy civil:** support plan sheets, profiles, utility sheets, traffic control sheets, typicals, erosion control plans.
- **Simple:** optional/lightweight mode.

## 7.8 RFIs and Technical Questions
- Formal RFI workflow.
- Internal question workflow.
- Assignment, due date, ball-in-court tracking.
- Official responses, attachments, linked drawings/specs.
- Potential cost/schedule impact flags.
- Distribution logging.
- Email-based participation for external design team where needed.

## 7.9 Submittals / Material Approvals
- Submittal register.
- Package and item level tracking.
- Revision cycles.
- Review routing.
- Spec section linkage.
- Procurement status integration.
- Long-lead flagging.
- Approved-as-noted / rejected handling.
- Sample/mockup/test submittal types.

## 7.10 Meetings and Coordination
- Meeting schedules and agenda templates.
- Attendees by company.
- Action items conversion to tasks.
- Decision log.
- Follow-up reminders.
- Meeting types:
  - OAC,
  - subcontractor coordination,
  - owner meeting,
  - safety,
  - quality,
  - production/planning,
  - closeout.

## 7.11 Daily Logs / Field Reports
- Daily log creation by role and template.
- Labor, equipment, weather, visitors, deliveries, delays, incidents, notes, photos.
- Save drafts and submit final.
- Approvals/lock after cutoff.
- Daily summary export.
- Multi-log per project/day if needed by area/crew.

Mode specifics:
- **Simple:** simpler narrative + photos + completed work.
- **Vertical:** manpower by trade, inspections, deliveries, delays.
- **Heavy civil:** crew production, quantities installed, equipment hours, trucking loads, station/segment/location.

## 7.12 Labor, Crew, and Resource Management
- Workforce directory.
- Crew templates.
- Labor classifications.
- Certifications and expirations.
- Crew assignment by day/project/cost code/activity.
- Timesheet or integration hooks.
- Productivity metrics.

Heavy civil needs deeper support:
- production crew composition,
- operator/laborer ratios,
- shift planning,
- spread management,
- self-perform cost capture.

## 7.13 Equipment Management
- Equipment master list.
- Owned/rented/subcontracted equipment classification.
- Utilization tracking.
- Assignment by project/crew/activity.
- Fuel/maintenance hooks roadmap.
- Downtime tracking.
- Attach inspection records.

Heavy civil: critical.  
Vertical: moderate.  
Simple: optional/basic.

## 7.14 Materials, Deliveries, and Tickets
- Material catalog.
- Purchase linkage.
- Delivery logs.
- Receiving records.
- Ticket capture (hauling, concrete, asphalt, aggregate, disposal, trucking).
- Quantity/unit reconciliation.
- Cost allocation.

Heavy civil requires:
- ticket-heavy workflows,
- load counts,
- haul source/destination,
- unit conversions,
- reconciliation to pay quantities.

## 7.15 Production and Quantities
High priority for heavy civil, optional for others.

- Budgeted quantities by pay item/cost code/activity.
- Installed quantities daily.
- Earned quantities / percent complete.
- Production rates.
- Forecast-to-complete.
- Quantity backup and supporting evidence.
- Location-based quantity tracking.
- Survey/as-built import roadmap.
- Unit cost reporting.

## 7.16 Financial Management
Core across all modes, with different depth by tier.

Required capabilities:
- Budget setup and revisions.
- Original budget, approved changes, current budget.
- Commitments / POs / subcontracts.
- Vendor management.
- Owner contract / prime contract.
- Change events and change orders.
- Potential change items.
- Cost-to-complete.
- Forecast final cost.
- Invoicing/billing integration.
- Retainage support.
- Schedule of values.
- Cost code and contract item alignment.
- Financial approval workflows.
- Audit trail.

Mode differences:
- **Simple:** budget, invoices, changes, basic margin view.
- **Vertical:** full commitments, PCCOs, owner COs, pay apps, budget transfers, prime/owner billings.
- **Heavy civil:** cost codes + pay items + production earned value, T&M/force account, ticket-backed costs, claims/evidence support.

## 7.17 Procurement and Long Lead Management
- Procurement log.
- Bid package / vendor comparison.
- Award recommendation.
- Lead times.
- Need-by dates.
- Fabrication/shipping/milestone tracking.
- Constraint alerts.

## 7.18 Change Management
- Potential change event initiation from field, RFI, owner request, design revision, unforeseen condition, utility conflict, quantity overrun, delay.
- Pricing workflow.
- Internal review.
- External submission.
- Change order conversion.
- Status and aging tracking.
- Cost and schedule impact tracking.

Heavy civil extras:
- changed conditions,
- force account/T&M,
- quantity overruns/underruns,
- owner-directed work,
- claims support package generation.

## 7.19 Quality Management
- Inspections.
- Test reports.
- Non-conformance reports.
- Deficiency tracking.
- Punch lists / observations.
- QA/QC checklists.
- Closeout verification.

## 7.20 Safety Management
- Incidents and near misses.
- Safety observations.
- Toolbox talks.
- JHAs/JSAs/THAs.
- Corrective actions.
- Documented signoffs.
- PPE and training compliance.

Heavy civil requires stronger support for:
- utility hazards,
- traffic control,
- excavation/trenching,
- equipment interactions,
- environmental controls.

## 7.21 Compliance and Public Sector Requirements
- Certified payroll integration points.
- M/WBE/DBE participation tracking.
- Lien and insurance certificate tracking.
- Permits.
- Environmental compliance logs.
- Public owner report templates.
- Document retention and dispute support.

## 7.22 Inspections, Tests, and Commissioning
- Inspection request logs.
- Test result capture.
- Defect resolution.
- Witness/hold point support.
- Startup/commissioning workflows.
- Pre-closeout checklists.

## 7.23 Schedule and Planning
- Milestone schedule.
- Task schedule.
- Import of external schedules.
- 2-week / 3-week / 6-week look-ahead.
- Constraint log.
- Delay tracking.
- What-changed snapshots.

Heavy civil adds:
- production sequencing,
- closure windows,
- crew spread planning,
- haul/logistics timing.

## 7.24A AI-Assisted Project Ingest and Auto-Bootstrap
High priority for Vertical and Heavy Civil; optional/reduced version for Simple.

Required capabilities:
- upload package support for drawings, specifications, bid schedules, contracts, addenda, geotech reports, permits, schedules, scope sheets, utility records, and other preconstruction/project documents,
- AI extraction and classification of uploaded documents,
- auto-creation of project shell and metadata,
- auto-generation of document register, drawing register, spec section index, and revision logs,
- auto-generation of project directory suggestions from document participants,
- auto-generation of cost code, bid item, phase, and work-package suggestions,
- auto-generation of procurement items and long-lead watchlist,
- auto-seeding of RFI register, submittal register, issue/risk log, meeting cadences, daily log templates, safety plans, quality checklists, and startup task lists,
- auto-identification of permitting/compliance artifacts,
- auto-identification of heavy civil pay items, quantities, segments, utility runs, structures, traffic control phases, and production activities where feasible,
- auto-identification of vertical building areas, floors, disciplines, specification-driven procurement scopes, and closeout requirements,
- user review/approval workflow before publishing AI-created structures,
- confidence scoring, source traceability, and exception queues for low-confidence extraction,
- re-run capability after addenda or drawing revisions,
- comparison of new uploads against prior versions to identify changed scope.

AI governance requirements:
- every AI-generated artifact must preserve source links to originating documents/pages where possible,
- no AI-created financial or contractual record may publish without human approval,
- audit log must record who approved generated structures,
- tenants must be able to disable or limit AI automation by module.

## 7.24 GIS / Maps / Location Intelligence
Important for heavy civil and sitework.

- Map-enabled project view.
- Geotagged photos/issues/logs.
- Segment/area/station referencing.
- Utility/asset location context.
- Layer overlays roadmap.

## 7.25 Client / Owner / External Portal
- Controlled external access.
- View-only and action-based permissions.
- Approval workflows.
- Progress photo gallery.
- Document access.
- Billing/change visibility by role.
- Branded experience.

## 7.26 Closeout / Turnover / Warranty
- Closeout checklist.
- As-built docs.
- O&M manuals.
- Training records.
- Warranty items.
- Turnover packages.
- Post-closeout service requests.

## 7.27 Search, Knowledge, and AI Readiness
- Global search across projects, docs, records, and messages.
- Structured tags.
- Semantic search roadmap.
- OCR/document extraction roadmap.
- AI copilots roadmap for summarization, action extraction, and risk surfacing.

---

## 8. Mode Toggle Behavior Requirements

The platform must not merely hide/show menu items. Mode toggles must alter:
- default data schema usage,
- default project templates,
- required forms,
- terminology,
- workflows,
- dashboard KPIs,
- permissions presets,
- record types,
- validation rules,
- mobile UX priorities,
- integrations enabled.

### 8.1 Toggle Types
- **Tenant mode** — default operating model for the company.
- **Business-unit mode** — overrides by division.
- **Project mode** — override for individual projects.
- **Feature pack** — enable supplemental capabilities across modes.

### 8.2 Example Toggle Outcomes
**Simple mode default dashboard**
- active jobs,
- overdue tasks,
- recent job thread activity,
- pending approvals,
- budget health,
- punch items.

**Vertical mode default dashboard**
- overdue RFIs,
- submittal aging,
- change events,
- manpower,
- inspections,
- commitments and billings,
- procurement risks.

**Heavy civil mode default dashboard**
- installed vs budgeted quantities,
- production rates,
- crew/equipment utilization,
- hauling/ticket counts,
- cost-to-complete by activity,
- weather and delay impacts,
- owner pay item progress.

---

## 9. User Personas
- Tenant admin
- Executive
- Operations manager
- Project manager
- Project engineer
- Superintendent
- Foreman
- Field engineer
- Estimator/preconstruction manager
- Controller/accountant
- AP/AR specialist
- Safety manager
- Quality manager
- Equipment manager
- Procurement manager
- Client/owner rep
- Architect/engineer reviewer
- Subcontractor/vendor user
- Inspector/regulator
- Admin
- Executive
- Manager
- Recruiter
- Coordinator
- Capture Manager
- Program Manager
- Account Executive
- Viewer

---

## 10. RBAC Requirements

Role permissions must be configurable, but standard templates should exist.

### 10.1 Baseline Permission Dimensions
- tenant admin
- organization admin
- business unit admin
- project admin
- financial admin
- field-only user
- external collaborator
- owner/client user
- read-only auditor
- admin
- executive
- manager
- recruiter
- coordinator
- capture manager
- program manager
- account executive
- viewer

### 10.2 Object-Level Permission Needs
Permissions must be manageable for:
- projects,
- job threads,
- tasks,
- documents,
- RFIs,
- submittals,
- meetings,
- daily logs,
- budgets,
- commitments,
- change events,
- safety,
- quality,
- equipment,
- tickets,
- reports,
- integrations,
- administration,
- CRM accounts/contacts,
- ATS candidates/jobs/submissions,
- placements,
- timesheets,
- invoicing,
- contracts,
- commissions,
- compliance records,
- federal capture/proposals,
- onboarding workflows,
- workflow engine configuration,
- audit log access.

---

## 11. Non-Functional Requirements

### 11.1 Security
- Tenant isolation must be enforced in application and database access layers.
- Encryption in transit and at rest.
- Secrets managed securely.
- SSO and MFA.
- Permission checks server-side.
- Full audit logging.
- Session controls and device management.
- Webhook signature validation.
- Data export restrictions by role.

### 11.2 Performance
- Normal page loads under 2 seconds for standard screens at target scale.
- Search responses under 3 seconds for common queries.
- Bulk imports and exports handled asynchronously.
- Support large project document sets without UI collapse.

### 11.3 Scalability
- Must support:
  - many tenants,
  - tens of thousands of users,
  - document-heavy projects,
  - long-lived audit history,
  - event-driven automation.

### 11.4 Reliability
- Backups.
- Disaster recovery objectives.
- Queue retry logic.
- Graceful degradation for third-party outages.
- Status and observability.

### 11.5 Compliance and Privacy
- Configurable retention.
- Data deletion policies by tenant and law.
- Regional hosting roadmap.
- Litigation hold support.

### 11.6 Accessibility
- WCAG-aware UI targets.
- Mobile usability in sun/glove/field conditions considered in design system.

---

## 12. Suggested Platform Architecture

Based on patterns observed in the other eclawbot2-dot project (`face-project`), a practical initial architecture for this repo is:
- **Frontend:** Next.js web app
- **Backend:** Next.js server actions / route handlers initially; modular service layer required
- **ORM/data layer:** Prisma
- **Auth:** NextAuth/Auth.js or enterprise SSO-compatible auth layer
- **Database:** Postgres preferred for enterprise multi-tenancy; SQLite acceptable only for local prototyping
- **Storage:** object storage for documents/photos
- **Background jobs:** queue worker for notifications, imports, exports, OCR, sync, report generation
- **Search:** full-text initially, semantic roadmap later
- **Deployment:** Vercel/web + managed DB/object storage, or private deployment option

### 12.1 Required Architectural Domains
- identity-access
- tenant-admin
- org-master-data
- crm-preconstruction
- project-core
- communications/job-thread
- documents
- drawings-specs
- technical-workflows (RFI/submittals)
- field-operations
- labor-equipment-materials
- production-quantities
- financial-controls
- quality-safety-compliance
- reporting-analytics
- integrations
- automation

### 12.2 Data Model Guidance
Shared core entities should include:
- Tenant
- Organization / BusinessUnit
- User / Membership / Role
- Contact / Company
- Project
- ProjectMode
- Phase / CostCode / PayItem / WBSNode
- Thread / ThreadMessage / Comment / Decision
- Task / Checklist / Workflow
- Document / FileVersion / Folder / Transmittal
- Drawing / Sheet / SpecSection
- RFI / Submittal / Meeting / Minute / ActionItem
- DailyLog / LaborEntry / EquipmentEntry / MaterialEntry / DelayEntry
- Budget / BudgetLine / Commitment / ChangeEvent / ChangeOrder / Billing
- QuantityBudget / QuantityInstalled / ProductionEntry / Ticket
- SafetyIncident / Observation / Inspection / NCR / PunchItem
- PortalShare / Approval / AuditEvent / Notification / IntegrationConnection

---

## 13. Reference Sweep from Existing eclawbot2-dot Projects

### 13.1 Repositories Reviewed
- `eclawbot2-dot/construction-project` — target repository created for this effort.
- `eclawbot2-dot/face-project` — reviewed for implementation patterns and baseline stack.

### 13.2 Findings from face-project
Observed stack indicators from repo metadata/files:
- Next.js app foundation
- Prisma data layer
- Auth-ready architecture direction
- TypeScript-based web application pattern

Applicable lessons for construction-project:
- Use a modern TypeScript web stack.
- Retain Prisma for initial schema authoring.
- Upgrade from simple/local DB defaults to enterprise-grade Postgres for production.
- Preserve portability but design for document-heavy, workflow-heavy, multi-tenant construction data.

### 13.3 Construction-Relevant Feature Inheritance from Existing Repo Patterns
Even though `face-project` is not construction software, the following reusable patterns are relevant:
- user identity and roles,
- master data management,
- CRUD-heavy admin surfaces,
- document-linked workflows,
- permissions and reporting,
- Next.js + Prisma architecture baseline.

No other eclawbot2-dot repositories were available at the time of this sweep to inspect for construction-specific features.

---

## 14. MVP Recommendation

### 14.1 MVP Objective
Launch a serious but scoped enterprise foundation that demonstrates all three mode packs from one platform.

### 14.2 MVP v1 Included
**Shared core**
- multi-tenant auth and org/project setup
- RBAC
- project master data
- document storage
- job thread
- tasks/checklists
- daily logs
- basic budget/change tracking
- dashboards
- audit log

**Simple mode v1**
- job thread
- tasks/checklists
- client portal lite
- photos/files
- simple budget and CO log
- punch list

**Vertical mode v1**
- RFIs
- submittals
- drawings/spec register
- meeting minutes
- observations/punch
- commitments/change events lite
- historical bid library foundation
- AI project ingest v1 for drawing/spec/contract bootstrap

**Heavy civil mode v1**
- pay items/cost codes
- quantities budgeted vs installed
- production daily entries
- equipment/labor entries
- tickets lite
- location/segment tagging
- historical unit-cost / bid-item intelligence foundation
- AI project ingest v1 for pay item / document / structure bootstrap

### 14.3 Deferred to Phase 2+
- advanced billing/pay apps
- full procurement workflows
- deep ERP sync
- certified payroll
- GIS overlays
- advanced inspections/commissioning
- AI document extraction
- telematics integrations
- claims package automation

---

## 15. Acceptance Criteria Summary

The platform will satisfy this requirements document when:
- one codebase supports all three operating modes,
- tenant/project mode toggles materially alter workflows and UX,
- shared enterprise controls are present,
- simple mode is easy enough for small contractors,
- vertical mode covers Procore-class core workflows,
- heavy civil mode covers production/quantity/ticket/equipment workflows,
- auditability and permissions are strong enough for enterprise use,
- the repo contains clear implementation guidance tied to these requirements.

---

## 16. Proposed Next Deliverables
- Product architecture spec
- Data model / ERD
- RBAC matrix
- Module-by-module implementation plan
- UI information architecture
- MVP backlog and milestone plan
- deployment architecture for conmgmt.jahdev.com

---

## 10.3 Required Named Role Templates
The following named role templates must be included in the platform requirements and initial RBAC design:
- Admins
- Executives
- Managers
- Recruiters
- Coordinators
- Capture Managers
- Program Managers
- Account Executives
- Viewers

Each template must define default permissions across construction operations and enterprise shared-service modules, while remaining tenant-configurable.

## 17. Improvements Added

Beyond the original ask, this document also adds:
- a three-mode architecture model instead of just a feature list,
- explicit mode-toggle behavior requirements,
- cross-mode common core requirements,
- non-functional enterprise constraints,
- reference sweep notes from other eclawbot2-dot repos,
- MVP and phase guidance,
- historical bid intelligence requirements for Vertical and Heavy Civil,
- AI-assisted project ingest and auto-bootstrap requirements for non-simple modes,
- shared-service enterprise module requirements for CRM, ATS, placements, timesheets, invoicing, contracts, commissions, compliance, federal proposal capture, onboarding, workflow engine, and audit logging,
- explicit named role templates for Admins, Executives, Managers, Recruiters, Coordinators, Capture Managers, Program Managers, Account Executives, and Viewers.

Why: this keeps the repo from turning into a vague wish list and makes it implementable.
