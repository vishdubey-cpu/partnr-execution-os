import { cn } from "@/lib/utils";

interface StatsCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  accent?: "default" | "red" | "amber" | "green" | "blue";
  icon?: React.ReactNode;
}

const accentMap = {
  default: "border-gray-200",
  red: "border-red-400",
  amber: "border-amber-400",
  green: "border-green-400",
  blue: "border-blue-400",
};

const valueColorMap = {
  default: "text-gray-900",
  red: "text-red-600",
  amber: "text-amber-600",
  green: "text-green-600",
  blue: "text-blue-600",
};

export function StatsCard({
  label,
  value,
  sublabel,
  accent = "default",
  icon,
}: StatsCardProps) {
  return (
    <div
      className={cn(
        "bg-white rounded-lg border p-5 border-l-4",
        accentMap[accent]
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            {label}
          </p>
          <p className={cn("text-3xl font-bold mt-1", valueColorMap[accent])}>
            {value}
          </p>
          {sublabel && (
            <p className="text-xs text-gray-400 mt-1">{sublabel}</p>
          )}
        </div>
        {icon && (
          <div className="text-gray-300 mt-1">{icon}</div>
        )}
      </div>
    </div>
  );
}
