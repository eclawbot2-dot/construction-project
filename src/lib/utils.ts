import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Locale + currency utilities. Per-tenant settings live on
 * Tenant.locale + Tenant.currency (defaults en-US + USD). Server
 * components that already have the tenant on hand can pass them
 * explicitly; helpers are tenant-agnostic so any caller works.
 */

export function formatDate(date: Date | string | null | undefined, locale: string = "en-US"): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(date: Date | string | null | undefined, locale: string = "en-US"): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatCurrency(value: number | { toNumber: () => number } | null | undefined, currency: string = "USD", locale: string = "en-US"): string {
  if (value === null || value === undefined) return "—";
  // Accept both Float (number) and Prisma Decimal (has .toNumber()).
  // Intl.NumberFormat takes number, so we always coerce here.
  const n = typeof value === "number"
    ? value
    : typeof value === "object" && typeof value.toNumber === "function"
      ? value.toNumber()
      : NaN;
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value)}%`;
}

export function roleLabel(role: string): string {
  const map: Record<string, string> = {
    ADMIN: "Admin",
    EXECUTIVE: "Executive",
    MANAGER: "Manager",
    RECRUITER: "Recruiter",
    COORDINATOR: "Coordinator",
    CAPTURE_MANAGER: "Capture Manager",
    PROGRAM_MANAGER: "Program Manager",
    ACCOUNT_EXECUTIVE: "Account Executive",
    VIEWER: "Viewer",
    PROJECT_ENGINEER: "Project Engineer",
    SUPERINTENDENT: "Superintendent",
    FOREMAN: "Foreman",
    CONTROLLER: "Controller",
    SAFETY_MANAGER: "Safety Manager",
    QUALITY_MANAGER: "Quality Manager",
  };
  return map[role] ?? role.replaceAll("_", " ");
}

export function modeLabel(mode: string): string {
  const map: Record<string, string> = {
    SIMPLE: "Simple Construction PM",
    VERTICAL: "Vertical Building",
    HEAVY_CIVIL: "Heavy Civil",
  };
  return map[mode] ?? mode.replaceAll("_", " ");
}

/**
 * Mode-specific color tokens for visual scannability. Pass in a Tailwind
 * variant of color (border / bg / text) and the mode; returns the right
 * class string. Use modeBadge() for the standard pill format.
 */
export function modeColor(mode: string, kind: "border" | "bg" | "text" = "text"): string {
  const palette: Record<string, { border: string; bg: string; text: string }> = {
    SIMPLE:      { border: "border-sky-500/40",     bg: "bg-sky-500/10",     text: "text-sky-200" },
    VERTICAL:    { border: "border-violet-500/40",  bg: "bg-violet-500/10",  text: "text-violet-200" },
    HEAVY_CIVIL: { border: "border-amber-500/40",   bg: "bg-amber-500/10",   text: "text-amber-200" },
  };
  return palette[mode]?.[kind] ?? (kind === "text" ? "text-slate-300" : kind === "bg" ? "bg-slate-500/10" : "border-slate-500/40");
}

/**
 * Render a short mode label (3 letters) for tight spaces — list rows,
 * cards, sidebars. Full label via modeLabel(). Color via modeColor().
 */
export function modeShort(mode: string): string {
  const map: Record<string, string> = { SIMPLE: "SIM", VERTICAL: "VRT", HEAVY_CIVIL: "HCV" };
  return map[mode] ?? mode.slice(0, 3).toUpperCase();
}

export function workflowStatusLabel(status: string): string {
  const map: Record<string, string> = {
    DRAFT: "Draft",
    UNDER_REVIEW: "Under Review",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    CLOSED: "Closed",
  };
  return map[status] ?? status.replaceAll("_", " ");
}

export function taskStatusLabel(status: string): string {
  const map: Record<string, string> = {
    TODO: "To Do",
    IN_PROGRESS: "In Progress",
    BLOCKED: "Blocked",
    COMPLETE: "Complete",
  };
  return map[status] ?? status.replaceAll("_", " ");
}

export function statusTone(status: string): "good" | "warn" | "bad" | "neutral" | "info" {
  const GOOD = new Set(["APPROVED", "EXECUTED", "PASS", "PAID", "RECEIVED", "ACTIVE", "COMPLETE", "COMPLETED"]);
  const WARN = new Set(["PENDING", "PENDING_APPROVAL", "SUBMITTED", "CONDITIONAL", "NEGOTIATING", "UNDER_REVIEW", "IN_PROGRESS"]);
  const BAD = new Set(["REJECTED", "FAIL", "EXPIRED", "TERMINATED", "VOID", "BLOCKED"]);
  const INFO = new Set(["DRAFT", "TODO", "WAIVED"]);
  if (GOOD.has(status)) return "good";
  if (BAD.has(status)) return "bad";
  if (WARN.has(status)) return "warn";
  if (INFO.has(status)) return "info";
  return "neutral";
}

export function changeOrderKindLabel(kind: string): string {
  const map: Record<string, string> = {
    PCO: "Potential CO",
    COR: "CO Request",
    OCO: "Owner CO",
    INTERNAL: "Internal",
  };
  return map[kind] ?? kind;
}

export function contractTypeLabel(type: string): string {
  const map: Record<string, string> = {
    PRIME_OWNER: "Prime / Owner",
    SUBCONTRACT: "Subcontract",
    PURCHASE_ORDER: "Purchase Order",
    MSA: "MSA",
    TASK_ORDER: "Task Order",
    GC_CONTRACT: "GC Contract",
    FEE_AGREEMENT: "Fee Agreement",
  };
  return map[type] ?? type.replaceAll("_", " ");
}

export function lienWaiverTypeLabel(type: string): string {
  const map: Record<string, string> = {
    CONDITIONAL_PARTIAL: "Conditional · Partial",
    UNCONDITIONAL_PARTIAL: "Unconditional · Partial",
    CONDITIONAL_FINAL: "Conditional · Final",
    UNCONDITIONAL_FINAL: "Unconditional · Final",
  };
  return map[type] ?? type.replaceAll("_", " ");
}

export function inspectionKindLabel(kind: string): string {
  const map: Record<string, string> = {
    MUNICIPAL: "Municipal",
    THIRD_PARTY: "Third-party",
    INTERNAL_QC: "Internal QC",
    PRE_POUR: "Pre-pour",
    PRE_COVER: "Pre-cover",
    FINAL: "Final",
    OSHA: "OSHA",
    ENVIRONMENTAL: "Environmental",
  };
  return map[kind] ?? kind.replaceAll("_", " ");
}
