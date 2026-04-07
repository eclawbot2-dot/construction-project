# Data Model Notes

## Core entity groups

### Tenant and identity
- `Tenant`
- `BusinessUnit`
- `User`
- `Membership`

These model the enterprise boundary, business-unit segmentation, and named role templates.

### CRM / org master data
- `Company`
- `Contact`

These are shared across all project modes.

### Project core
- `Project`
- `WorkflowTemplate`
- `WorkflowRun`

Projects carry the active operating mode and configuration JSON to support mode-dependent behavior.

### Communication and execution
- `Thread`
- `ThreadMessage`
- `Task`
- `DailyLog`
- `Meeting`

This covers the PRD's Job Thread and execution backbone.

### Documents and technical workflows
- `Document`
- `RFI`
- `Submittal`

This is the initial vertical-building-ready technical workflow layer.

### Financial and operational control
- `Budget`
- `BudgetLine`
- `QuantityBudget`
- `ProductionEntry`
- `Ticket`

This supports both budget control and heavy civil production tracking.

### Risk / governance
- `SafetyIncident`
- `PunchItem`
- `Approval`
- `AuditEvent`

These anchor auditability, compliance, and quality/safety growth.

## ERD direction

### Tenant hierarchy
`Tenant -> BusinessUnit -> Project`

### User access
`User -> Membership -> Tenant`

### Project execution
`Project -> Thread -> ThreadMessage`
`Project -> Task`
`Project -> DailyLog`
`Project -> Meeting`

### Technical workflows
`Project -> Document`
`Project -> RFI`
`Project -> Submittal`

### Financials and civil production
`Project -> Budget -> BudgetLine`
`Project -> QuantityBudget`
`Project -> ProductionEntry`
`Project -> Ticket`

### Governance
`Tenant -> AuditEvent`
`User -> Approval`

## Intentional MVP omissions

The PRD mentions many future entities not fully modeled yet, including:
- transmittals,
- file versions,
- spec sections / sheet registers,
- commitments / change orders / billings,
- equipment master,
- material receipts,
- inspections / NCRs,
- client portal shares,
- integration connections,
- ATS / placements / commissions / federal proposal capture modules.

Those should be added as bounded modules on top of this foundation rather than collapsing everything into one giant initial schema.
