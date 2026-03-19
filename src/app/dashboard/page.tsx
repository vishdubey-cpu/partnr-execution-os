import { DashboardStats } from "@/types";
import { OwnerStatsTable } from "@/components/dashboard/OwnerStatsTable";
import { timeAgo } from "@/lib/utils";
import {
  AlertTriangle, Clock, TrendingUp, CheckSquare,
  ArrowUpCircle, MessageCircle, ChevronDown, Skull,
} from "lucide-react";

async function getDashboard(): Promise<DashboardStats> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/dashboard`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("Failed to load dashboard");
  return res.json();
}

const urgencyBorder = { critical: "border-l-red-600", high: "border-l-orange-500", medium: "border-l-amber-400" };
const urgencyDot = { critical: "bg-red-500", high: "bg-orange-400", medium: "bg-amber-400" };

export default async function DashboardPage() {
  const data = await getDashboard();

  const hasUrgent = data.needsYouNow.length > 0;
  const hasWatchList = data.watchList.length > 0;
  const hasZombies = data.zombieTasks.length > 0;

  return (
    <div className="p-4 md:p-6 max-w-screen-xl mx-auto">

      {/* ── Top Line ──────────────────────────────────────────── */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">
          {hasUrgent ? "⚠️ Needs your attention" : hasWatchList ? "👀 Watch closely" : "✅ Execution on track"}
        </h1>
        <p className="text-sm text-gray-500 mt-1">{data.topLine}</p>
      </div>

      {/* ── Stats Row ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Open Tasks", value: data.totalOpenTasks, color: "text-blue-600", bg: "bg-blue-50", icon: <CheckSquare size={18} /> },
          { label: "Overdue", value: data.overdueTasks, color: "text-red-600", bg: "bg-red-50", icon: <AlertTriangle size={18} /> },
          { label: "Due Today", value: data.dueTodayTasks, color: "text-amber-600", bg: "bg-amber-50", icon: <Clock size={18} /> },
          { label: "On-Time Rate", value: `${data.onTimeClosureRate}%`, color: "text-green-600", bg: "bg-green-50", icon: <TrendingUp size={18} /> },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4 flex items-center gap-3`}>
            <span className={s.color}>{s.icon}</span>
            <div>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Zone 1: Needs You Now ──────────────────────────────── */}
      {hasUrgent && (
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
              Needs Your Decision — {data.needsYouNow.length} item{data.needsYouNow.length > 1 ? "s" : ""}
            </h2>
          </div>
          <div className="space-y-2">
            {data.needsYouNow.map((t) => (
              <a
                key={t.id}
                href={`/tasks/${t.id}`}
                className={`flex items-start justify-between bg-white border-l-4 ${urgencyBorder[t.urgency]} rounded-r-xl border border-l-0 border-gray-200 px-4 py-3 hover:bg-gray-50 transition-colors`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${urgencyDot[t.urgency]}`} />
                    <p className="text-sm font-semibold text-gray-900 truncate">{t.title}</p>
                  </div>
                  <p className="text-xs text-gray-500 ml-3.5">{t.owner} · {t.reason}</p>
                </div>
                <span className="text-xs text-indigo-600 font-medium ml-3 flex-shrink-0">Decide →</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ── Zone 2: Watch List ──────────────────────────────────── */}
      {hasWatchList && (
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
              Watch This Week — {data.watchList.length} item{data.watchList.length > 1 ? "s" : ""}
            </h2>
          </div>
          <div className="space-y-2">
            {data.watchList.map((t) => (
              <a
                key={t.id}
                href={`/tasks/${t.id}`}
                className="flex items-start justify-between bg-white border-l-4 border-l-amber-400 rounded-r-xl border border-l-0 border-gray-200 px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{t.title}</p>
                  <p className="text-xs text-gray-500">{t.owner} · {t.reason}</p>
                </div>
                <span className="text-xs text-gray-400 ml-3 flex-shrink-0">View →</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ── Zone 3: Zombie Tasks ────────────────────────────────── */}
      {hasZombies && (
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <Skull size={14} className="text-gray-400" />
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
              Zombie Tasks — {data.zombieTasks.length} item{data.zombieTasks.length > 1 ? "s" : ""} with no activity in 21+ days
            </h2>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
            <p className="text-xs text-gray-500 mb-2">These tasks are stale. Close, reassign, or break them down before they become noise.</p>
            {data.zombieTasks.map((t) => (
              <a
                key={t.id}
                href={`/tasks/${t.id}`}
                className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-2.5 hover:bg-gray-50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-700 truncate">{t.title}</p>
                  <p className="text-xs text-gray-400">{t.owner} · {t.daysSinceActivity}d no activity</p>
                </div>
                <span className="text-xs text-gray-400 ml-3 flex-shrink-0">Review →</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ── Zone 4: Running Fine ────────────────────────────────── */}
      {data.runningFineCount > 0 && (
        <details className="mb-5 group">
          <summary className="flex items-center gap-2 cursor-pointer list-none">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
            <span className="text-sm font-bold text-gray-900 uppercase tracking-wide">
              Running Fine — {data.runningFineCount} task{data.runningFineCount !== 1 ? "s" : ""} on track
            </span>
            <ChevronDown size={14} className="text-gray-400 ml-1 group-open:rotate-180 transition-transform" />
          </summary>
          <p className="text-xs text-gray-400 mt-2 ml-4">These tasks are on track. No action needed.</p>
        </details>
      )}

      <hr className="my-6 border-gray-100" />

      {/* ── Owner Execution Scorecard ────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 mb-5">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">Execution Scorecard by Owner</h2>
          <p className="text-xs text-gray-400 mt-0.5">Who commits vs who delivers</p>
        </div>
        <div className="p-2">
          <OwnerStatsTable data={data.ownerStats} />
        </div>
      </div>

      {/* ── Bottom Row ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Needs Escalation */}
        <div id="escalation" className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <ArrowUpCircle size={14} className="text-orange-500" />
            <h2 className="text-sm font-semibold text-gray-800">Needs Escalation</h2>
            <span className="ml-auto text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
              {data.needsEscalation.length}
            </span>
          </div>
          <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
            {data.needsEscalation.length === 0 ? (
              <p className="text-sm text-gray-400">No tasks pending escalation</p>
            ) : (
              data.needsEscalation.map((task) => {
                const daysOverdue = task.dueDate ? Math.floor((Date.now() - new Date(task.dueDate).getTime()) / (1000 * 60 * 60 * 24)) : 0;
                return (
                  <a key={task.id} href={`/tasks/${task.id}`} className="flex items-center justify-between p-2.5 rounded bg-orange-50 hover:bg-orange-100 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{task.title}</p>
                      <p className="text-xs text-gray-500">{task.owner} · {task.function}</p>
                    </div>
                    <span className="text-xs font-semibold text-orange-600 ml-3 whitespace-nowrap">{daysOverdue}d overdue</span>
                  </a>
                );
              })
            )}
          </div>
        </div>

        {/* Recent Reminders */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <MessageCircle size={14} className="text-indigo-500" />
            <h2 className="text-sm font-semibold text-gray-800">Recent Reminders Sent</h2>
          </div>
          <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
            {data.recentReminders.length === 0 ? (
              <p className="text-sm text-gray-400">No reminders sent yet</p>
            ) : (
              data.recentReminders.map((r) => (
                <div key={r.id} className="flex items-start justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-700 truncate">{r.task?.title}</p>
                    <p className="text-xs text-gray-400">→ {r.recipientName || r.task?.owner} · <span className="font-medium text-indigo-600">{r.type}</span></p>
                  </div>
                  <span className="text-xs text-gray-400 ml-2 whitespace-nowrap">{timeAgo(r.sentAt)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
