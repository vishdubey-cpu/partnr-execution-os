import { format, formatDistanceToNow, isAfter, isBefore, isToday, startOfDay, endOfDay, startOfWeek, endOfWeek } from "date-fns";
import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatDate(date: Date | string | null | undefined) {
  if (!date) return "No date set";
  return format(new Date(date), "dd MMM yyyy");
}

export function formatDateTime(date: Date | string) {
  return format(new Date(date), "dd MMM yyyy, hh:mm a");
}

export function timeAgo(date: Date | string) {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function isOverdue(dueDate: Date | string, status: string) {
  if (status === "DONE") return false;
  return isBefore(new Date(dueDate), new Date());
}

export function isDueToday(dueDate: Date | string) {
  return isToday(new Date(dueDate));
}

export function getDaysOverdue(dueDate: Date | string | null | undefined): number {
  if (!dueDate) return 0;
  const due = new Date(dueDate);
  const now = new Date();
  if (isAfter(due, now)) return 0;
  const diff = now.getTime() - due.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function getWeekRange() {
  const now = new Date();
  return {
    start: startOfWeek(now, { weekStartsOn: 1 }),
    end: endOfWeek(now, { weekStartsOn: 1 }),
  };
}

export const STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  DONE: "Done",
  DELAYED: "Delayed",
  OVERDUE: "Overdue",
};

export const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-800",
  DONE: "bg-green-100 text-green-800",
  DELAYED: "bg-amber-100 text-amber-800",
  OVERDUE: "bg-red-100 text-red-800",
};

export const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

export const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-600",
  MEDIUM: "bg-blue-100 text-blue-700",
  HIGH: "bg-orange-100 text-orange-700",
  CRITICAL: "bg-red-100 text-red-700",
};

export const FUNCTIONS = [
  "HR",
  "Sales",
  "Operations",
  "Finance",
  "Technology",
  "Strategy",
  "Marketing",
  "Legal",
];

export const SOURCES = [
  "Leadership Meeting",
  "Board Review",
  "Weekly Sync",
  "Decision Log",
  "Client Review",
  "Quarterly Planning",
  "1:1 Meeting",
  "Other",
];
