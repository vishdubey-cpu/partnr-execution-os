import { WeeklyReview } from "@/types";
import { formatDate } from "@/lib/utils";
import { OwnerStatsTable } from "@/components/dashboard/OwnerStatsTable";
import { TaskTable } from "@/components/tasks/TaskTable";
import { WeeklySummaryCard } from "@/components/dashboard/WeeklySummaryCard";
import {
  TrendingUp,
  TrendingDown,
  CheckSquare,
  PlusCircle,
  AlertTriangle,
  Trophy,
  UserX,
} from "lucide-react";
async function getWeeklyReview(): Promise<WeeklyReview & { whatsappSummaryText?: string }> {
  // Fetches from the weekly-review API which now includes whatsappSummaryText
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/weekly-review`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("Failed to load weekly review");
  return res.json();
}

export default async function WeeklyReviewPage() {
  const data = await getWeeklyReview();

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Weekly Review</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {formatDate(data.periodStart)} – {formatDate(data.periodEnd)}
        </p>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-blue-200 border-l-4 p-5">
          <div className="flex items-center gap-3">
            <PlusCircle size={20} className="text-blue-400" />
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                Tasks Created
              </p>
              <p className="text-3xl font-bold text-blue-600 mt-0.5">
                {data.tasksCreated}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-green-200 border-l-4 p-5">
          <div className="flex items-center gap-3">
            <CheckSquare size={20} className="text-green-400" />
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                Tasks Closed
              </p>
              <p className="text-3xl font-bold text-green-600 mt-0.5">
                {data.tasksClosed}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-red-200 border-l-4 p-5">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} className="text-red-400" />
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                Still Overdue
              </p>
              <p className="text-3xl font-bold text-red-600 mt-0.5">
                {data.overdueCount}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Performers */}
      <div className="grid grid-cols-2 gap-5 mb-5">
        {/* Top Performers */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Trophy size={16} className="text-amber-500" />
            <h2 className="text-sm font-semibold text-gray-800">
              Top Performers
            </h2>
          </div>
          {data.topPerformers.length === 0 ? (
            <p className="text-sm text-gray-400">No closed tasks this week</p>
          ) : (
            <div className="space-y-3">
              {data.topPerformers.map((p, i) => (
                <div
                  key={p.owner}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        i === 0
                          ? "bg-amber-100 text-amber-700"
                          : i === 1
                          ? "bg-gray-100 text-gray-600"
                          : "bg-orange-100 text-orange-600"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {p.owner}
                      </p>
                      <p className="text-xs text-gray-400">{p.function}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-green-600">
                      {p.closureRate}%
                    </p>
                    <p className="text-xs text-gray-400">
                      {p.done}/{p.total}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Attention Needed */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <UserX size={16} className="text-red-500" />
            <h2 className="text-sm font-semibold text-gray-800">
              Needs Attention
            </h2>
          </div>
          {data.attentionNeeded.length === 0 ? (
            <p className="text-sm text-gray-400">All owners on track</p>
          ) : (
            <div className="space-y-3">
              {data.attentionNeeded.map((p) => (
                <div
                  key={p.owner}
                  className="flex items-center justify-between p-2 bg-red-50 rounded"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {p.owner}
                    </p>
                    <p className="text-xs text-gray-400">{p.function}</p>
                  </div>
                  <div className="text-right">
                    {p.overdue > 0 && (
                      <p className="text-xs font-semibold text-red-600">
                        {p.overdue} overdue
                      </p>
                    )}
                    <p className="text-xs text-gray-400">
                      {p.closureRate}% closed
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Owner Stats Full Table */}
      <div className="bg-white rounded-lg border border-gray-200 mb-5">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">
            Owner-wise Performance
          </h2>
        </div>
        <div className="p-2">
          <OwnerStatsTable data={data.ownerStats} />
        </div>
      </div>

      {/* Tasks sections */}
      {data.createdTasks.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 mb-5">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <TrendingUp size={14} className="text-blue-500" />
              Tasks Created This Week ({data.createdTasks.length})
            </h2>
          </div>
          <TaskTable tasks={data.createdTasks} />
        </div>
      )}

      {data.closedTasks.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 mb-5">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <CheckSquare size={14} className="text-green-500" />
              Tasks Closed This Week ({data.closedTasks.length})
            </h2>
          </div>
          <TaskTable tasks={data.closedTasks} />
        </div>
      )}

      {data.overdueTasks.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 mb-5">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <TrendingDown size={14} className="text-red-500" />
              Still Overdue ({data.overdueTasks.length})
            </h2>
          </div>
          <TaskTable tasks={data.overdueTasks} showDaysOverdue />
        </div>
      )}

      {/* WhatsApp Summary Card */}
      {data.whatsappSummaryText && (
        <WeeklySummaryCard summaryText={data.whatsappSummaryText} />
      )}
    </div>
  );
}
