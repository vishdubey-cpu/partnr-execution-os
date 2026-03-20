import { DashboardStats } from "@/types";
import { OwnerStatsTable } from "@/components/dashboard/OwnerStatsTable";
import { PulseDecisionCards } from "@/components/dashboard/PulseDecisionCards";
import { timeAgo } from "@/lib/utils";
import {
  AlertTriangle, Clock, TrendingUp, CheckSquare,
  ArrowUpCircle, MessageCircle, ChevronDown, Skull, Users,
} from "lucide-react";

async function getDashboard(): Promise<DashboardStats> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/dashboard`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("Failed to load dashboard");
  return res.json();
}

const headlineStates = {
  calm: {
    bg: "bg-green-50", border: "border-green-200", dotColor: "bg-green-500", pulse: false,
    badge: "bg-green-100 text-green-700", badgeLabel: "On Track",
    headline: (_d: DashboardStats) => "Execution is largely on track today.",
    sub: (d: DashboardStats) =>
      d.runningFineCount > 0
        ? `${d.runningFineCount} task${d.runningFineCount !== 1 ? "s" : ""} running cleanly. No intervention needed.`
        : "No critical blockers or escalations today.",
  },
  watchful: {
    bg: "bg-amber-50", border: "border-amber-200", dotColor: "bg-amber-400", pulse: false,
    badge: "bg-amber-100 text-amber-700", badgeLabel: "Watch Closely",
    headline: (_d: DashboardStats) => "A few important things are drifting.",
    sub: (d: DashboardStats) =>
      `${d.watchList.length} task${d.watchList.length !== 1 ? "s" : ""} may need intervention this week before they escalate.`,
  },
  bad: {
    bg: "bg-orange-50", border: "border-orange-200", dotColor: "bg-orange-500", pulse: true,
    badge: "bg-orange-100 text-orange-700", badgeLabel: "Execution Risk",
    headline: (_d: DashboardStats) => "Execution risk is building.",
    sub: (d: DashboardStats) =>
      `${d.needsYouNow.length} item${d.needsYouNow.length !== 1 ? "s" : ""} blocked${d.zombieTasks.length > 0 ? ` and ${d.zombieTasks.length} tasks going stale` : ""}. Your input is needed.`,
  },
  critical: {
    bg: "bg-red-50", border: "border-red-200", dotColor: "bg-red-500", pulse: true,
    badge: "bg-red-100 text-red-700", badgeLabel: "Attention Required",
    headline: (_d: DashboardStats) => "Leadership attention required today.",
    sub: (d: DashboardStats) =>
      `${d.needsYouNow.length} critical item${d.needsYouNow.length !== 1 ? "s" : ""} cannot be resolved without your input.`,
  },
};

const reliabilityConfig = {
  AT_RISK: { label: "At Risk", bg: "bg-red-50",   border: "border-red-200",   badge: "bg-red-100 text-red-700"   },
  WATCH:   { label: "Watch",   bg: "bg-amber-50", border: "border-amber-200", badge: "bg-amber-100 text-amber-700" },
  STRONG:  { label: "Strong",  bg: "bg-green-50", border: "border-green-200", badge: "bg-green-100 text-green-700" },
};

export default async function DashboardPage() {
  const data = await getDashboard();

  const state = headlineStates[data.headlineState ?? "calm"];
  const hasUrgent = data.needsYouNow.length > 0;
  const hasWatchList = data.watchList.length > 0;
  const hasZombies = data.zombieTasks.length > 0;
  const hasPeopleFlags = data.peopleReliability?.some(
    (p) => p.reliabilityLabel === "AT_RISK" || p.reliabilityLabel === "WATCH"
  );

  return (
    <div className="p-4 md:p-6 max-w-screen-xl mx-auto">

      {/* ── Headline Strip ─────────────────────────────────────────── */}
      <div className={`${state.bg} border ${state.border} rounded-xl px-5 py-4 mb-6`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-1 flex-shrink-0">
              <div className={`w-2.5 h-2.5 rounded-full ${state.dotColor} ${state.pulse ? "animate-pulse" : ""}`} />
            </div>
            <div>
              <p className="text-base font-bold text-gray-900 leading-snug">
                {state.headline(data)}
              </p>
              <p className="text-sm text-gray-500 mt-0.5">{state.sub(data)}</p>
            </div>
          </div>
          <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${state.badge}`}>
              {state.badgeLabel}
            </span>
            <span className="text-xs text-gray-400">
              {new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
            </span>
          </div>
        </div>
      </div>

      {/* ── Stats Row ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Open Tasks",   value: data.totalOpenTasks,          color: "text-blue-600",  bg: "bg-blue-50",  icon: <CheckSquare size={18} />, href: "/tasks" },
          { label: "Overdue",      value: data.overdueTasks,            color: "text-red-600",   bg: "bg-red-50",   icon: <AlertTriangle size={18} />, href: "/overdue" },
          { label: "Due Today",    value: data.dueTodayTasks,           color: "text-amber-600", bg: "bg-amber-50", icon: <Clock size={18} />, href: "/tasks" },
          { label: "On-Time Rate", value: `${data.onTimeClosureRate}%`, color: "text-green-600", bg: "bg-green-50", icon: <TrendingUp size={18} />, href: "/weekly-review" },
        ].map((s) => (
          <a key={s.label} href={s.href} className={`${s.bg} rounded-xl p-4 flex items-center gap-3 hover:brightness-95 transition-all cursor-pointer`}>
            <span className={s.color}>{s.icon}</span>
            <div>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          </a>
        ))}
      </div>

      {/* ── Section 2: Needs Your Decision ─────────────────────────── */}
      {hasUrgent && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
              Needs Your Decision
            </h2>
            <span className="ml-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">
              {data.needsYouNow.length}
            </span>
          </div>
          <p className="text-xs text-gray-400 mb-3 ml-4">
            These items require intervention, not monitoring.
          </p>
          <PulseDecisionCards tasks={data.needsYouNow} />
        </div>
      )}

      {/* ── Section 3: What Is Drifting ────────────────────────────── */}
      {hasWatchList && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
              What Is Drifting
            </h2>
            <span className="ml-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
              {data.watchList.length}
            </span>
          </div>
          <p className="text-xs text-gray-400 mb-3 ml-4">
            Not broken yet — but moving in the wrong direction.
          </p>
          <div className="space-y-2">
            {data.watchList.map((t) => (
              <a
                key={t.id}
                href={`/tasks/${t.id}`}
                className="flex items-start justify-between bg-white border-l-4 border-l-amber-400 rounded-r-xl border border-l-0 border-gray-200 px-4 py-3 hover:bg-amber-50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{t.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{t.owner} · {t.reason}</p>
                </div>
                <span className="text-xs text-gray-400 ml-3 flex-shrink-0 mt-0.5">Watch →</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ── Section 4: People Requiring Attention ─────────────────── */}
      {hasPeopleFlags && data.peopleReliability && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Users size={14} className="text-gray-500" />
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
              People Requiring Attention
            </h2>
          </div>
          <p className="text-xs text-gray-400 mb-3 ml-5">
            Execution patterns matter more than isolated misses.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.peopleReliability.map((person) => {
              const cfg = reliabilityConfig[person.reliabilityLabel];
              return (
                <a
                  key={person.owner}
                  href={`/my-tasks/${encodeURIComponent(person.owner)}`}
                  className={`${cfg.bg} border ${cfg.border} rounded-xl p-4 block hover:brightness-95 transition-all cursor-pointer`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{person.owner}</p>
                      <p className="text-xs text-gray-400">{person.function}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.badge}`}>
                      {cfg.label}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs mb-2">
                    <span className="text-gray-500">{person.activeTasks} active</span>
                    {person.onTimeRate > 0 && <span className="text-gray-500">{person.onTimeRate}% on-time</span>}
                    {person.delayed > 0 && <span className="text-amber-600 font-medium">{person.delayed} delayed</span>}
                    {person.silent > 0 && <span className="text-red-500 font-medium">{person.silent} silent</span>}
                  </div>
                  <p className="text-xs text-gray-600 italic mb-2 leading-relaxed">{person.patternInsight}</p>
                  {person.suggestedAction && (
                    <p className="text-xs text-gray-500">
                      <span className="font-semibold not-italic">Action:</span> {person.suggestedAction}
                    </p>
                  )}
                  <p className="text-xs text-indigo-500 font-semibold mt-2">View {person.owner}&apos;s tasks →</p>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Zombie Tasks ────────────────────────────────────────────── */}
      {hasZombies && (
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <Skull size={14} className="text-gray-400" />
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
              Zombie Tasks — {data.zombieTasks.length} with no activity in 21+ days
            </h2>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
            <p className="text-xs text-gray-500 mb-2">Close, reassign, or break them down before they become noise.</p>
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

      {/* ── Running Fine ────────────────────────────────────────────── */}
      {data.runningFineCount > 0 && (
        <details className="mb-5 group">
          <summary className="flex items-center gap-2 cursor-pointer list-none">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
            <span className="text-sm font-bold text-gray-900 uppercase tracking-wide">
              Running Fine — {data.runningFineCount} task{data.runningFineCount !== 1 ? "s" : ""} on track
            </span>
            <ChevronDown size={14} className="text-gray-400 ml-1 group-open:rotate-180 transition-transform" />
          </summary>
          <p className="text-xs text-gray-400 mt-2 ml-4">These tasks are progressing. No action needed.</p>
        </details>
      )}

      <hr className="my-6 border-gray-100" />

      {/* ── Execution Scorecard ─────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 mb-5">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">Execution Scorecard by Owner</h2>
          <p className="text-xs text-gray-400 mt-0.5">Who commits vs who delivers</p>
        </div>
        <div className="p-2">
          <OwnerStatsTable data={data.ownerStats} />
        </div>
      </div>

      {/* ── Bottom Row ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
                const daysOverdue = task.dueDate
                  ? Math.floor((Date.now() - new Date(task.dueDate).getTime()) / (1000 * 60 * 60 * 24))
                  : 0;
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
