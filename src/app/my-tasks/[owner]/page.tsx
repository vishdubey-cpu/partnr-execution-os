import { notFound } from "next/navigation";

interface OwnerTask {
  id: string;
  title: string;
  source: string | null;
  dueDate: string | null;
  status: string;
  priority: string;
  function: string;
  isOverdue: boolean;
  daysOverdue: number | null;
}

interface ReliabilityStats {
  doneTasks: number;
  onTimeCount: number;
  lateCount: number;
  onTimeRate: number | null;
  totalDelayCount: number;
  reliabilityLabel: "STRONG" | "WATCH" | "AT_RISK" | null;
  patternInsight: string;
}

async function getOwnerTasks(
  owner: string
): Promise<{ owner: string; tasks: OwnerTask[]; reliability: ReliabilityStats }> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/my-tasks/${encodeURIComponent(owner)}`,
    { cache: "no-store" }
  );
  if (!res.ok) notFound();
  return res.json();
}

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  OPEN:    { label: "Open",    bg: "bg-blue-50",   text: "text-blue-700"   },
  DELAYED: { label: "Delayed", bg: "bg-amber-50",  text: "text-amber-700"  },
  OVERDUE: { label: "Overdue", bg: "bg-red-50",    text: "text-red-700"    },
};

const priorityDot: Record<string, string> = {
  CRITICAL: "bg-red-500",
  HIGH:     "bg-orange-400",
  MEDIUM:   "bg-amber-400",
  LOW:      "bg-gray-300",
};

const reliabilityConfig: Record<
  "STRONG" | "WATCH" | "AT_RISK",
  { label: string; bg: string; border: string; text: string; bar: string }
> = {
  STRONG:  { label: "Strong Executor",  bg: "bg-green-50",  border: "border-green-200", text: "text-green-700",  bar: "bg-green-500"  },
  WATCH:   { label: "Needs Attention",  bg: "bg-amber-50",  border: "border-amber-200", text: "text-amber-700",  bar: "bg-amber-400"  },
  AT_RISK: { label: "At Risk",          bg: "bg-red-50",    border: "border-red-200",   text: "text-red-700",    bar: "bg-red-500"    },
};

export default async function MyTasksPage({ params }: { params: { owner: string } }) {
  const ownerName = decodeURIComponent(params.owner);
  const { tasks, reliability } = await getOwnerTasks(ownerName);

  const overdue = tasks.filter((t) => t.isOverdue);
  const onTrack = tasks.filter((t) => !t.isOverdue);
  const relCfg = reliability.reliabilityLabel ? reliabilityConfig[reliability.reliabilityLabel] : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-5">
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Your tasks</p>
        <h1 className="text-xl font-bold text-gray-900">{ownerName}</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {tasks.length === 0
            ? "No open tasks right now."
            : `${tasks.length} open task${tasks.length !== 1 ? "s" : ""}${overdue.length > 0 ? ` · ${overdue.length} overdue` : ""}`}
        </p>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-5">

        {/* Reliability score card — only shown when there's history to report */}
        {relCfg && (
          <div className={`rounded-xl border ${relCfg.border} ${relCfg.bg} p-4`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Your Execution Score</p>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${relCfg.bg} ${relCfg.text} border ${relCfg.border}`}>
                {relCfg.label}
              </span>
            </div>

            {reliability.onTimeRate !== null && (
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500">On-time delivery</span>
                  <span className={`text-sm font-bold ${relCfg.text}`}>{reliability.onTimeRate}%</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${relCfg.bar}`}
                    style={{ width: `${reliability.onTimeRate}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
              <span>{reliability.doneTasks} completed</span>
              {reliability.totalDelayCount > 0 && (
                <span className="text-amber-600 font-medium">{reliability.totalDelayCount} delay{reliability.totalDelayCount !== 1 ? "s" : ""}</span>
              )}
              {reliability.lateCount > 0 && (
                <span className="text-red-500 font-medium">{reliability.lateCount} late</span>
              )}
            </div>

            <p className="text-xs text-gray-500 italic">{reliability.patternInsight}</p>
          </div>
        )}

        {/* Overdue section */}
        {overdue.length > 0 && (
          <div>
            <p className="text-xs font-bold text-red-600 uppercase tracking-wide mb-2">
              Overdue — action needed
            </p>
            <div className="space-y-2">
              {overdue.map((t) => (
                <TaskCard key={t.id} task={t} />
              ))}
            </div>
          </div>
        )}

        {/* On-track section */}
        {onTrack.length > 0 && (
          <div>
            {overdue.length > 0 && (
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                In progress
              </p>
            )}
            <div className="space-y-2">
              {onTrack.map((t) => (
                <TaskCard key={t.id} task={t} />
              ))}
            </div>
          </div>
        )}

        {tasks.length === 0 && (
          <div className="text-center py-16">
            <p className="text-3xl mb-3">✅</p>
            <p className="text-base font-semibold text-gray-700">All clear</p>
            <p className="text-sm text-gray-400 mt-1">No open tasks assigned to you.</p>
          </div>
        )}

        <p className="text-xs text-center text-gray-300 pt-4">Partnr Execution OS</p>
      </div>
    </div>
  );
}

function TaskCard({ task }: { task: OwnerTask }) {
  const cfg = statusConfig[task.isOverdue ? "OVERDUE" : task.status] ?? statusConfig.OPEN;
  const dot = priorityDot[task.priority] ?? priorityDot.MEDIUM;

  const dueLabel = task.dueDate
    ? task.isOverdue && task.daysOverdue !== null
      ? `${task.daysOverdue}d overdue`
      : `Due ${new Date(task.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
    : "No due date";

  return (
    <a
      href={`/task-view/${task.id}`}
      className={`block bg-white rounded-xl border ${task.isOverdue ? "border-red-200" : "border-gray-200"} px-4 py-3.5 hover:bg-gray-50 transition-colors`}
    >
      <div className="flex items-start gap-2.5">
        <div className={`w-2 h-2 rounded-full ${dot} mt-1.5 flex-shrink-0`} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 leading-snug">{task.title}</p>

          {task.source && (
            <p className="text-xs text-gray-400 mt-1 italic line-clamp-2">
              &ldquo;{task.source}&rdquo;
            </p>
          )}

          <div className="flex items-center gap-2 mt-2">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
              {cfg.label}
            </span>
            <span className={`text-xs ${task.isOverdue ? "text-red-500 font-semibold" : "text-gray-400"}`}>
              {dueLabel}
            </span>
            <span className="text-xs text-gray-400">{task.function}</span>
          </div>
        </div>
        <span className="text-xs text-indigo-500 flex-shrink-0 mt-0.5">Update →</span>
      </div>
    </a>
  );
}
