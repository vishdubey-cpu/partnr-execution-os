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

// ── Score card config ──────────────────────────────────────────────────────
const reliabilityConfig = {
  STRONG: {
    emoji: "🏆",
    label: "Strong Executor",
    gradient: "from-green-500 to-emerald-600",
    bg: "bg-gradient-to-br from-green-50 to-emerald-50",
    border: "border-green-200",
    text: "text-green-800",
    sub: "text-green-600",
    bar: "bg-green-500",
    badge: "bg-green-100 text-green-800 border-green-300",
    message: (name: string) => `${name}, you're delivering consistently. Keep it up!`,
  },
  WATCH: {
    emoji: "👀",
    label: "Needs Attention",
    gradient: "from-amber-400 to-orange-500",
    bg: "bg-gradient-to-br from-amber-50 to-orange-50",
    border: "border-amber-200",
    text: "text-amber-800",
    sub: "text-amber-600",
    bar: "bg-amber-400",
    badge: "bg-amber-100 text-amber-800 border-amber-300",
    message: (name: string) => `${name}, a few things need your attention. You can turn this around.`,
  },
  AT_RISK: {
    emoji: "🚨",
    label: "At Risk",
    gradient: "from-red-500 to-rose-600",
    bg: "bg-gradient-to-br from-red-50 to-rose-50",
    border: "border-red-200",
    text: "text-red-800",
    sub: "text-red-600",
    bar: "bg-red-500",
    badge: "bg-red-100 text-red-800 border-red-300",
    message: (name: string) => `${name}, some tasks need immediate action. Your team is counting on you.`,
  },
  NEW: {
    emoji: "🌱",
    label: "Building track record",
    gradient: "from-indigo-400 to-violet-500",
    bg: "bg-gradient-to-br from-indigo-50 to-violet-50",
    border: "border-indigo-200",
    text: "text-indigo-800",
    sub: "text-indigo-600",
    bar: "bg-indigo-400",
    badge: "bg-indigo-100 text-indigo-800 border-indigo-300",
    message: (name: string) => `Welcome ${name}! Complete your tasks on time to build a strong track record.`,
  },
};

// ── Task card urgency styling ──────────────────────────────────────────────
function getCardStyle(task: OwnerTask): { border: string; leftBar: string } {
  if (task.isOverdue)            return { border: "border-red-200",   leftBar: "bg-red-400"   };
  if (task.status === "DELAYED") return { border: "border-amber-200", leftBar: "bg-amber-400" };
  return                                { border: "border-gray-200",  leftBar: "bg-indigo-300" };
}

const statusLabel: Record<string, { text: string; bg: string; color: string }> = {
  OPEN:    { text: "Open",    bg: "bg-blue-100",  color: "text-blue-700"  },
  DELAYED: { text: "Delayed", bg: "bg-amber-100", color: "text-amber-700" },
  OVERDUE: { text: "Overdue", bg: "bg-red-100",   color: "text-red-700"   },
};

const priorityDot: Record<string, string> = {
  CRITICAL: "bg-red-500",
  HIGH:     "bg-orange-400",
  MEDIUM:   "bg-amber-400",
  LOW:      "bg-gray-300",
};

export default async function MyTasksPage({ params }: { params: { owner: string } }) {
  const ownerName = decodeURIComponent(params.owner);
  const { tasks, reliability } = await getOwnerTasks(ownerName);

  const overdue = tasks.filter((t) => t.isOverdue);
  const onTrack = tasks.filter((t) => !t.isOverdue);

  // Pick the right score config — always show something
  const scoreKey: keyof typeof reliabilityConfig =
    reliability.reliabilityLabel ?? "NEW";
  const score = reliabilityConfig[scoreKey];
  const firstName = ownerName.split(" ")[0];

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-100 px-5 pt-6 pb-5">
        <p className="text-xs font-semibold text-indigo-500 uppercase tracking-widest mb-1">Your Tasks</p>
        <h1 className="text-2xl font-extrabold text-gray-900">{ownerName}</h1>
        <p className="text-sm text-gray-400 mt-1">
          {tasks.length === 0
            ? "No open tasks right now — all clear! ✅"
            : (
              <>
                {tasks.length} open task{tasks.length !== 1 ? "s" : ""}
                {overdue.length > 0 && (
                  <> · <span className="text-red-500 font-semibold">{overdue.length} overdue</span></>
                )}
              </>
            )}
        </p>
      </div>

      <div className="px-4 pt-5 pb-10 max-w-lg mx-auto space-y-5">

        {/* ── Score / motivation card — ALWAYS shown ── */}
        <div className={`rounded-2xl border ${score.border} ${score.bg} overflow-hidden`}>
          {/* Gradient top strip */}
          <div className={`h-1.5 bg-gradient-to-r ${score.gradient}`} />
          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xl">{score.emoji}</span>
                  <span className={`text-xs font-bold uppercase tracking-wide ${score.sub}`}>
                    Your Execution Score
                  </span>
                </div>
                <p className={`text-sm font-semibold leading-snug ${score.text}`}>
                  {score.message(firstName)}
                </p>
              </div>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full border flex-shrink-0 ${score.badge}`}>
                {score.label}
              </span>
            </div>

            {/* On-time progress bar — only when there&apos;s history */}
            {reliability.onTimeRate !== null && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-xs font-medium ${score.sub}`}>On-time delivery</span>
                  <span className={`text-sm font-extrabold ${score.text}`}>{reliability.onTimeRate}%</span>
                </div>
                <div className="h-2.5 bg-white rounded-full overflow-hidden border border-gray-200">
                  <div
                    className={`h-full rounded-full ${score.bar}`}
                    style={{ width: `${reliability.onTimeRate}%` }}
                  />
                </div>
              </div>
            )}

            {/* Stats row */}
            <div className={`flex flex-wrap items-center gap-4 mt-3 text-xs ${score.sub}`}>
              {reliability.doneTasks > 0 && (
                <span>✅ {reliability.doneTasks} completed</span>
              )}
              {reliability.totalDelayCount > 0 && (
                <span>🕐 {reliability.totalDelayCount} delay{reliability.totalDelayCount !== 1 ? "s" : ""}</span>
              )}
              {reliability.lateCount > 0 && (
                <span>⚠️ {reliability.lateCount} late</span>
              )}
              {reliability.doneTasks === 0 && (
                <span className="italic opacity-70">Complete tasks on time to build your score</span>
              )}
            </div>
          </div>
        </div>

        {/* ── Overdue tasks ── */}
        {overdue.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">🔴</span>
              <p className="text-xs font-extrabold text-red-600 uppercase tracking-widest">
                Overdue — action needed now
              </p>
            </div>
            <div className="space-y-3">
              {overdue.map((t) => <TaskCard key={t.id} task={t} />)}
            </div>
          </div>
        )}

        {/* ── On-track / in-progress tasks ── */}
        {onTrack.length > 0 && (
          <div>
            {overdue.length > 0 && (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base">📋</span>
                <p className="text-xs font-extrabold text-gray-500 uppercase tracking-widest">In Progress</p>
              </div>
            )}
            <div className="space-y-3">
              {onTrack.map((t) => <TaskCard key={t.id} task={t} />)}
            </div>
          </div>
        )}

        {/* ── All clear ── */}
        {tasks.length === 0 && (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🎉</div>
            <p className="text-lg font-bold text-gray-700">All clear, {firstName}!</p>
            <p className="text-sm text-gray-400 mt-1.5">No open tasks right now. Enjoy the moment.</p>
          </div>
        )}

        <p className="text-xs text-center text-gray-300 pt-4">Partnr Execution OS</p>
      </div>
    </div>
  );
}

// ── Task card ──────────────────────────────────────────────────────────────
function TaskCard({ task }: { task: OwnerTask }) {
  const style = getCardStyle(task);
  const dot   = priorityDot[task.priority] ?? priorityDot.MEDIUM;
  const sl    = statusLabel[task.isOverdue ? "OVERDUE" : task.status] ?? statusLabel.OPEN;

  const dueLabel = task.dueDate
    ? task.isOverdue && task.daysOverdue !== null
      ? `${task.daysOverdue}d overdue`
      : `Due ${new Date(task.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
    : "No due date";

  const btnStyle = task.isOverdue
    ? "bg-red-600 hover:bg-red-700 text-white"
    : task.status === "DELAYED"
    ? "bg-amber-500 hover:bg-amber-600 text-white"
    : "bg-indigo-600 hover:bg-indigo-700 text-white";

  return (
    <div className={`bg-white rounded-2xl border ${style.border} overflow-hidden shadow-sm`}>
      <div className="flex">
        {/* Left colour bar */}
        <div className={`w-1 flex-shrink-0 ${style.leftBar}`} />

        <div className="flex-1 px-4 py-4">
          <div className="flex items-start gap-3">
            {/* Priority dot + text */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2">
                <div className={`w-2 h-2 rounded-full ${dot} mt-1.5 flex-shrink-0`} />
                <p className="text-sm font-bold text-gray-900 leading-snug">{task.title}</p>
              </div>

              {task.source && (
                <p className="text-xs text-gray-400 mt-1.5 italic line-clamp-1 pl-4">
                  &ldquo;{task.source}&rdquo;
                </p>
              )}

              <div className="flex flex-wrap items-center gap-1.5 mt-2 pl-4">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${sl.bg} ${sl.color}`}>
                  {sl.text}
                </span>
                <span className={`text-xs font-medium ${task.isOverdue ? "text-red-500" : "text-gray-400"}`}>
                  {dueLabel}
                </span>
                {task.function && (
                  <span className="text-xs text-gray-400">{task.function}</span>
                )}
              </div>
            </div>

            {/* CTA button */}
            <a
              href={`/task-view/${task.id}`}
              className={`flex-shrink-0 text-xs font-bold px-3 py-2 rounded-xl transition-colors shadow-sm ${btnStyle}`}
            >
              View & Update →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
