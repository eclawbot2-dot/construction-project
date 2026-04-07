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

export function formatTime(time: string | null | undefined): string {
  if (!time) return "—";
  const [hours, minutes] = time.split(":").map(Number);
  const ampm = hours >= 12 ? "PM" : "AM";
  const h = hours % 12 || 12;
  return `${h}:${String(minutes).padStart(2, "0")} ${ampm}`;
}

export function gradeLevelLabel(grade: string): string {
  const map: Record<string, string> = {
    PRE_K: "Pre-K",
    KINDERGARTEN: "Kindergarten",
    GRADE_1: "1st Grade",
    GRADE_2: "2nd Grade",
    GRADE_3: "3rd Grade",
    GRADE_4: "4th Grade",
    GRADE_5: "5th Grade",
    GRADE_6: "6th Grade",
    GRADE_7: "7th Grade",
    GRADE_8: "8th Grade",
    ADULT: "Adult",
  };
  return map[grade] ?? grade;
}

export function roleLabel(role: string): string {
  const map: Record<string, string> = {
    ADMIN: "Administrator",
    DIRECTOR: "Director",
    CATECHIST: "Catechist",
    PARENT: "Parent",
  };
  return map[role] ?? role;
}

export function attendanceStatusLabel(status: string): string {
  const map: Record<string, string> = {
    PRESENT: "Present",
    ABSENT: "Absent",
    LATE: "Tardy",
    EXCUSED: "Excused",
  };
  return map[status] ?? status;
}

export const GRADE_LEVELS = [
  { value: "PRE_K", label: "Pre-K" },
  { value: "KINDERGARTEN", label: "Kindergarten" },
  { value: "GRADE_1", label: "1st Grade" },
  { value: "GRADE_2", label: "2nd Grade" },
  { value: "GRADE_3", label: "3rd Grade" },
  { value: "GRADE_4", label: "4th Grade" },
  { value: "GRADE_5", label: "5th Grade" },
  { value: "GRADE_6", label: "6th Grade" },
  { value: "GRADE_7", label: "7th Grade" },
  { value: "GRADE_8", label: "8th Grade" },
  { value: "ADULT", label: "Adult" },
];

export const PROGRAMS = [
  "Pre-K Faith Formation",
  "Elementary Faith Formation",
  "Middle School Faith Formation",
  "Confirmation Prep",
  "First Communion Prep",
  "RCIA",
  "Adult Faith Formation",
  "Bible Study",
  "Youth Ministry",
];

export const DAYS_OF_WEEK = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export const SACRAMENT_TYPES = [
  "Baptism",
  "First Reconciliation",
  "First Communion",
  "Confirmation",
  "Marriage",
];
