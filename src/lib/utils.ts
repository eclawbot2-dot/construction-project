import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
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
