import { DashboardStats } from "@/types";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { OwnerStatsTable } from "@/components/dashboard/OwnerStatsTable";
import { TaskTable } from "@/components/tasks/TaskTable";
import { timeAgo } from "@/lib/utils";
import {
  CheckSquare,
  AlertTriangle,
  Clock,
  TrendingUp,
  ArrowUpCircle,
  MessageCircle,
} from "lucide-react";

async function getDashboard(): Promise<DashboardStats> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/dashboard`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("Failed to load dashboard");
  return res.json();
}

export default async function DashboardPage() {
  const data = await getDashboard();

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Overview of all open tasks, overdue items, and owner performance
        </p>
      </div>

      {/* Escalation Alert Banner */}
      {data.needsEscalation.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-6 flex flex-wrap items-center gap-3">
          <ArrowUpCircle size={18} className="text-red-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-800">
              {data.needsEscalation.length} task{data.needsEscalation.length > 1 ? "s" : ""} need escalation now
            </p>
            <p className="text-xs text-red-600 mt-0.5 truncate">
              {data.needsEscalation.map((t) => t.owner).filter((v, i, a) => a.indexOf(v) === i).join(", ")} — overdue 3+ days, no escalation triggered
            </p>
          </div>
          <a href="#escalation" className="text-xs font-semibold text-red-700 hover:underline flex-shrink-0">
            View →
          </a>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatsCard
          label="Open Tasks"
          value={data.totalOpenTasks}
          sublabel="Open + Delayed"
          accent="blue"
          icon={<CheckSquare size={22} />}
        />
        <StatsCard
          label="Overdue"
          value={data.overdueTasks}
          sublabel="Past due date"
          accent="red"
          icon={<AlertTriangle size={22} />}
        />
        <StatsCard
          label="Due Today"
          value={data.dueTodayTasks}
          sublabel="Needs attention"
          accent="amber"
          icon={<Clock size={22} />}
        />
        <StatsCard
          label="On-Time Closure"
          value={`${data.onTimeClosureRate}%`}
          sublabel="Closed tasks"
          accent="green"
          icon={<TrendingUp size={22} />}
        />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
        {/* Owner Stats */}
        <div className="col-span-2 bg-white rounded-lg border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-800">
              Owner-wise Closure Rate
            </h2>
          </div>
          <div className="p-2">
            <OwnerStatsTable data={data.ownerStats} />
          </div>
        </div>

        {/* Overdue Summary */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">
              Overdue Summary
            </h2>
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
              {data.overdueTasksSummary.length} items
            </span>
          </div>
          <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
            {data.overdueTasksSummary.length === 0 ? (
              <p className="text-sm text-gray-400">No overdue tasks</p>
            ) : (
              data.overdueTasksSummary.map((task) => {
                const daysOverdue = task.dueDate ? Math.floor(
                  (Date.now() - new Date(task.dueDate).getTime()) /
                    (1000 * 60 * 60 * 24)
                ) : 0;
                return (
                  <a
                    key={task.id}
                    href={`/tasks/${task.id}`}
                    className="block p-3 rounded bg-red-50 hover:bg-red-100 transition-colors"
                  >
                    <p className="text-sm font-medium text-gray-800 line-clamp-1">
                      {task.title}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-500">{task.owner}</span>
                      <span className="text-xs font-medium text-red-600">
                        {daysOverdue}d overdue
                      </span>
                    </div>
                  </a>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Recent Tasks */}
      <div className="bg-white rounded-lg border border-gray-200 mb-5">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800">Recent Tasks</h2>
          <a
            href="/tasks"
            className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
          >
            View all
          </a>
        </div>
        <TaskTable tasks={data.recentTasks} />
      </div>

      {/* Escalation + Reminders row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Needs Escalation */}
        <div id="escalation" className="bg-white rounded-lg border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <ArrowUpCircle size={14} className="text-orange-500" />
            <h2 className="text-sm font-semibold text-gray-800">
              Needs Escalation
            </h2>
            <span className="ml-auto text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
              {data.needsEscalation.length}
            </span>
          </div>
          <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
            {data.needsEscalation.length === 0 ? (
              <p className="text-sm text-gray-400">
                No tasks pending escalation
              </p>
            ) : (
              data.needsEscalation.map((task) => {
                const daysOverdue = task.dueDate ? Math.floor(
                  (Date.now() - new Date(task.dueDate).getTime()) /
                    (1000 * 60 * 60 * 24)
                ) : 0;
                return (
                  <a
                    key={task.id}
                    href={`/tasks/${task.id}`}
                    className="flex items-center justify-between p-2.5 rounded bg-orange-50 hover:bg-orange-100 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {task.title}
                      </p>
                      <p className="text-xs text-gray-500">
                        {task.owner} · {task.function}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-orange-600 ml-3 whitespace-nowrap">
                      {daysOverdue}d overdue
                    </span>
                  </a>
                );
              })
            )}
          </div>
        </div>

        {/* Recent Reminders Sent */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <MessageCircle size={14} className="text-indigo-500" />
            <h2 className="text-sm font-semibold text-gray-800">
              Recent Reminders Sent
            </h2>
          </div>
          <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
            {data.recentReminders.length === 0 ? (
              <p className="text-sm text-gray-400">No reminders sent yet</p>
            ) : (
              data.recentReminders.map((r) => (
                <div
                  key={r.id}
                  className="flex items-start justify-between py-1.5 border-b border-gray-50 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-700 truncate">
                      {r.task?.title}
                    </p>
                    <p className="text-xs text-gray-400">
                      → {r.recipientName || r.task?.owner} ·{" "}
                      <span className="font-medium text-indigo-600">
                        {r.type}
                      </span>
                    </p>
                  </div>
                  <span className="text-xs text-gray-400 ml-2 whitespace-nowrap">
                    {timeAgo(r.sentAt)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
