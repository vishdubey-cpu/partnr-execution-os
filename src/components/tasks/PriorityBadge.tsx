import { cn, PRIORITY_COLORS, PRIORITY_LABELS } from "@/lib/utils";

interface PriorityBadgeProps {
  priority: string;
  size?: "sm" | "md";
}

export function PriorityBadge({ priority, size = "md" }: PriorityBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-medium rounded",
        PRIORITY_COLORS[priority] || "bg-gray-100 text-gray-600",
        size === "sm" ? "text-xs px-1.5 py-0.5" : "text-xs px-2 py-0.5"
      )}
    >
      {PRIORITY_LABELS[priority] || priority}
    </span>
  );
}
