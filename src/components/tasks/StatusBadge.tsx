import { cn, STATUS_COLORS, STATUS_LABELS } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md";
}

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-medium rounded-full",
        STATUS_COLORS[status] || "bg-gray-100 text-gray-600",
        size === "sm" ? "text-xs px-2 py-0.5" : "text-xs px-2.5 py-1"
      )}
    >
      {STATUS_LABELS[status] || status}
    </span>
  );
}
