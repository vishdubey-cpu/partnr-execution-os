import { Activity } from "@/types";
import { formatDateTime } from "@/lib/utils";
import { CheckCircle2, AlertCircle, MessageSquare, Clock, ArrowUpCircle, Edit2 } from "lucide-react";

interface ActivityLogProps {
  activities: Activity[];
}

const iconMap: Record<string, React.ReactNode> = {
  CREATED: <CheckCircle2 size={14} className="text-blue-500" />,
  STATUS_CHANGE: <Clock size={14} className="text-indigo-500" />,
  ESCALATION: <ArrowUpCircle size={14} className="text-red-500" />,
  COMMENT_ADDED: <MessageSquare size={14} className="text-gray-400" />,
  UPDATE: <Edit2 size={14} className="text-amber-500" />,
  REMINDER_SENT: <AlertCircle size={14} className="text-orange-400" />,
};

export function ActivityLog({ activities }: ActivityLogProps) {
  if (activities.length === 0) {
    return <p className="text-sm text-gray-400">No activity yet.</p>;
  }

  return (
    <div className="space-y-3">
      {activities.map((activity) => (
        <div key={activity.id} className="flex gap-3">
          <div className="mt-0.5 flex-shrink-0">
            {iconMap[activity.type] || <Clock size={14} className="text-gray-300" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-700">{activity.message}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {formatDateTime(activity.createdAt)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
