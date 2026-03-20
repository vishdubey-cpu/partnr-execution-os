"use client";

import { useState, useEffect, useRef } from "react";
import {
  CheckCircle2, Clock, AlertTriangle, TrendingUp,
  Calendar, User, MessageSquare, Activity, ChevronDown, ChevronUp,
} from "lucide-react";

interface TaskActivity {
  id: string;
  type: string;
  message: string;
  actor?: string | null;
  createdAt: string;
}

interface TaskComment {
  id: string;
  author: string;
  content: string;
  createdAt: string;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  owner: string;
  dueDate: string | null;
  status: string;
  priority: string;
  source: string | null;
  function: string;
  activities: TaskActivity[];
  comments: TaskComment[];
}

type Action = "delivered" | "on_track" | "delayed" | "blocked" | null;

const DELAY_REASONS = [
  "Blocked by someone else",
  "Waiting for information",
  "Underestimated scope",
  "Deprioritized",
] as const;

// ── Timeline builder ─────────────────────────────────────────────────────
type TimelineEntry =
  | { kind: "activity"; id: string; message: string; type: string; actor?: string | null; ts: Date }
  | { kind: "comment";  id: string; author: string;  content: string;                     ts: Date };

function buildTimeline(activities: TaskActivity[], comments: TaskComment[]): TimelineEntry[] {
  // Hide noisy system reminder entries from the owner view
  const hiddenTypes = ["REMINDER_SENT"];
  const acts: TimelineEntry[] = activities
    .filter((a) => !hiddenTypes.includes(a.type))
    .map((a) => ({ kind: "activity" as const, id: a.id, message: a.message, type: a.type, actor: a.actor, ts: new Date(a.createdAt) }));

  const cmts: TimelineEntry[] = comments.map((c) => ({
    kind: "comment" as const, id: c.id, author: c.author, content: c.content, ts: new Date(c.createdAt),
  }));

  return [...acts, ...cmts].sort((a, b) => a.ts.getTime() - b.ts.getTime());
}

function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)  return "just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  === 1) return "yesterday";
  if (days  < 7)  return `${days} days ago`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function formatFull(date: Date): string {
  return date.toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Page ─────────────────────────────────────────────────────────────────
export default function TaskViewPage({ params }: { params: { id: string } }) {
  const [task, setTask]           = useState<Task | null>(null);
  const [loading, setLoading]     = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<Action>(null);
  const [action, setAction]       = useState<Action>(null);
  const [note, setNote]           = useState("");
  const [newDate, setNewDate]     = useState("");
  const [delayReason, setDelayReason] = useState("");
  const [showFullHistory, setShowFullHistory] = useState(false);
  const pageLoadTime = useRef(Date.now());

  useEffect(() => {
    fetch(`/api/tasks/${params.id}`)
      .then((r) => r.json())
      .then((d) => { setTask(d?.error ? null : d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [params.id]);

  function selectAction(a: Action) {
    setAction(action === a ? null : a);
    setNote(""); setNewDate(""); setDelayReason("");
  }

  async function handleSubmit() {
    if (!task || !canSubmit) return;
    setSubmitting(true);
    const secondsOnPage = Math.floor((Date.now() - pageLoadTime.current) / 1000);
    const newStatus = action === "delivered" ? "DONE" : action === "on_track" ? task.status : "DELAYED";
    await fetch(`/api/tasks/${params.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: newStatus, note, action, quickClose: secondsOnPage < 60,
        ...(newDate     ? { newDueDate: newDate }  : {}),
        ...(delayReason ? { delayReason }           : {}),
      }),
    });
    setSubmitted(action);
    setSubmitting(false);
  }

  const canSubmit =
    (action === "on_track"  && note.trim().length >= 5) ||
    (action === "delivered" && note.trim().length >= 5) ||
    (action === "blocked"   && note.trim().length >= 5) ||
    (action === "delayed"   && !!delayReason);

  // ── Loading ───────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-sm text-gray-400">Loading…</p>
    </div>
  );

  // ── Task removed ──────────────────────────────────────────────────────
  if (!task) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center">
            <span className="text-white text-xs font-bold">P</span>
          </div>
          <span className="text-sm font-medium text-gray-500">Partnr · Task Update</span>
        </div>
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 size={28} className="text-gray-400" />
        </div>
        <h2 className="text-base font-semibold text-gray-800 mb-2">This task has been removed</h2>
        <p className="text-sm text-gray-500 leading-relaxed">
          This task no longer exists — it may have been closed or cancelled by your team.
          No action is needed from you.
        </p>
        <p className="text-xs text-gray-400 mt-6">If you think this is an error, check with your team lead.</p>
        <p className="text-xs text-gray-300 mt-10">Partnr Execution OS · Internal tool</p>
      </div>
    </div>
  );

  // ── Build timeline ────────────────────────────────────────────────────
  const timeline = buildTimeline(task.activities ?? [], task.comments ?? []);
  const PREVIEW  = 3;
  const visible  = showFullHistory ? timeline : timeline.slice(-PREVIEW);
  const hasMore  = timeline.length > PREVIEW;

  const due       = task.dueDate ? new Date(task.dueDate) : null;
  const dueLabel  = due ? due.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : null;
  const isOverdue = due && due < new Date() && task.status !== "DONE";

  const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
    OPEN:    { bg: "bg-blue-100",  text: "text-blue-700",  label: "Open"    },
    DELAYED: { bg: "bg-amber-100", text: "text-amber-700", label: "Delayed" },
    OVERDUE: { bg: "bg-red-100",   text: "text-red-700",   label: "Overdue" },
    DONE:    { bg: "bg-green-100", text: "text-green-700", label: "Done"    },
  };
  const sc = statusConfig[task.status] ?? statusConfig.OPEN;

  const priorityBadge: Record<string, string> = {
    CRITICAL: "text-red-600 bg-red-50 border-red-200",
    HIGH:     "text-orange-600 bg-orange-50 border-orange-200",
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="w-full max-w-md mx-auto space-y-4">

        {/* Header */}
        <div className="flex items-center gap-2 justify-center mb-2">
          <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center">
            <span className="text-white text-xs font-bold">P</span>
          </div>
          <span className="text-sm font-medium text-gray-500">Partnr · Task Update</span>
        </div>

        {/* ── Task card ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          {/* Top row: status + priority */}
          <div className="flex items-center gap-2 mb-3">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${sc.bg} ${sc.text}`}>{sc.label}</span>
            {task.priority && priorityBadge[task.priority] && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${priorityBadge[task.priority]}`}>
                {task.priority}
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-lg font-bold text-gray-900 leading-snug mb-3">{task.title}</h1>

          {/* Description */}
          {task.description && (
            <p className="text-sm text-gray-500 mb-3 leading-relaxed">{task.description}</p>
          )}

          {/* Meta */}
          <div className="space-y-1.5 mb-3">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <User size={13} className="text-gray-400 flex-shrink-0" />
              <span>{task.owner}</span>
              {task.function && <><span className="text-gray-300">·</span><span className="text-xs text-gray-400">{task.function}</span></>}
            </div>
            {dueLabel && (
              <div className={`flex items-center gap-2 text-sm ${isOverdue ? "text-red-600 font-semibold" : "text-gray-500"}`}>
                <Calendar size={13} className={`flex-shrink-0 ${isOverdue ? "text-red-500" : "text-gray-400"}`} />
                <span>{isOverdue ? `Overdue — was due ${dueLabel}` : `Due ${dueLabel}`}</span>
              </div>
            )}
          </div>

          {/* Context / source */}
          {task.source && (
            <div className="bg-slate-50 border-l-4 border-slate-300 rounded-r-xl px-3 py-2.5 mt-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Context</p>
              <p className="text-xs text-slate-600 italic leading-relaxed">&ldquo;{task.source}&rdquo;</p>
            </div>
          )}
        </div>

        {/* ── Task history / timeline ── */}
        {timeline.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Task History</p>
              <span className="text-xs text-gray-400">{timeline.length} update{timeline.length !== 1 ? "s" : ""}</span>
            </div>

            {/* Expand/collapse older entries */}
            {hasMore && (
              <button
                onClick={() => setShowFullHistory(!showFullHistory)}
                className="flex items-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-700 mb-3 transition-colors font-medium"
              >
                {showFullHistory
                  ? <><ChevronDown size={13} /> Show less</>
                  : <><ChevronUp   size={13} /> Show {timeline.length - PREVIEW} earlier update{timeline.length - PREVIEW !== 1 ? "s" : ""}</>
                }
              </button>
            )}

            <div className="space-y-4">
              {visible.map((entry) => {
                if (entry.kind === "comment") {
                  return (
                    <div key={entry.id} className="flex gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <MessageSquare size={12} className="text-indigo-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl rounded-tl-sm px-3.5 py-2.5">
                          <p className="text-xs font-bold text-indigo-700 mb-0.5">{entry.author}</p>
                          <p className="text-sm text-gray-700 leading-snug">{entry.content}</p>
                        </div>
                        <p className="text-xs text-gray-400 mt-1 ml-1" title={formatFull(entry.ts)}>
                          {relativeTime(entry.ts)}
                        </p>
                      </div>
                    </div>
                  );
                }

                const isKey = ["CREATED", "STATUS_CHANGE", "ESCALATION", "NOTE"].includes(entry.type);
                return (
                  <div key={entry.id} className="flex gap-2.5">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${isKey ? "bg-gray-100" : "bg-gray-50"}`}>
                      <Activity size={11} className={isKey ? "text-gray-500" : "text-gray-300"} />
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <p className={`text-sm leading-snug ${isKey ? "text-gray-600" : "text-gray-400"}`}>
                        {entry.message}
                      </p>
                      <p className="text-xs text-gray-300 mt-0.5" title={formatFull(entry.ts)}>
                        {relativeTime(entry.ts)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Already done ── */}
        {task.status === "DONE" && !submitted && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5 flex items-start gap-3">
            <CheckCircle2 size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-green-800">Already marked delivered</p>
              <p className="text-xs text-green-600 mt-0.5">Nothing more needed — great work!</p>
            </div>
          </div>
        )}

        {/* ── Success states ── */}
        {submitted === "delivered" && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
            <CheckCircle2 size={32} className="text-green-600 mx-auto mb-2" />
            <p className="text-base font-bold text-green-800">Delivered — well done! 🎉</p>
            <p className="text-xs text-green-600 mt-1">Your team has been notified.</p>
          </div>
        )}
        {submitted === "on_track" && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-6 text-center">
            <TrendingUp size={32} className="text-indigo-600 mx-auto mb-2" />
            <p className="text-base font-bold text-indigo-800">Next step logged — keep going.</p>
            <p className="text-xs text-indigo-600 mt-1">Your progress has been noted.</p>
          </div>
        )}
        {submitted === "delayed" && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
            <Clock size={32} className="text-amber-600 mx-auto mb-2" />
            <p className="text-base font-bold text-amber-800">Delay noted — team has been informed.</p>
            <p className="text-xs text-amber-600 mt-1">Thank you for keeping the team in the loop.</p>
          </div>
        )}
        {submitted === "blocked" && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
            <AlertTriangle size={32} className="text-red-500 mx-auto mb-2" />
            <p className="text-base font-bold text-red-800">Blocker reported — team has been alerted.</p>
            <p className="text-xs text-red-600 mt-1">Someone will follow up with you shortly.</p>
          </div>
        )}

        {/* ── Action panel ── */}
        {task.status !== "DONE" && !submitted && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <p className="text-sm font-bold text-gray-800 mb-0.5">Where do things stand?</p>
            <p className="text-xs text-gray-400 mb-4">Takes 15 seconds — your team will see it immediately.</p>

            {/* 2×2 action grid */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {(
                [
                  { id: "delivered" as const, Icon: CheckCircle2, label: "Delivered ✓",  sub: "Completed it",     selected: "bg-green-600 border-green-600 text-white",   idle: "hover:border-green-400 hover:text-green-700 hover:bg-green-50"   },
                  { id: "on_track"  as const, Icon: TrendingUp,   label: "On Track",     sub: "Going as planned", selected: "bg-indigo-600 border-indigo-600 text-white",  idle: "hover:border-indigo-400 hover:text-indigo-700 hover:bg-indigo-50" },
                  { id: "delayed"   as const, Icon: Clock,         label: "Delayed",      sub: "Need more time",   selected: "bg-amber-500 border-amber-500 text-white",    idle: "hover:border-amber-400 hover:text-amber-700 hover:bg-amber-50"   },
                  { id: "blocked"   as const, Icon: AlertTriangle, label: "Blocked",      sub: "Stuck, need help", selected: "bg-red-500 border-red-500 text-white",         idle: "hover:border-red-400 hover:text-red-700 hover:bg-red-50"         },
                ]
              ).map(({ id, Icon, label, sub, selected, idle }) => (
                <button
                  key={id}
                  onClick={() => selectAction(id)}
                  className={`flex flex-col items-center gap-1 py-4 px-2 rounded-xl border text-center transition-all ${
                    action === id ? selected : `border-gray-200 text-gray-600 ${idle}`
                  }`}
                >
                  <Icon size={20} />
                  <span className="text-xs font-bold leading-tight">{label}</span>
                  <span className={`text-xs leading-tight ${action === id ? "opacity-75" : "text-gray-400"}`}>{sub}</span>
                </button>
              ))}
            </div>

            {/* Dynamic input area */}
            {action && (
              <div className="space-y-3 pt-1 border-t border-gray-100">

                {/* Delayed reason — shown first, mandatory */}
                {action === "delayed" && (
                  <div className="pt-3">
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Why is it delayed? <span className="text-red-500">*</span>
                    </label>
                    <p className="text-xs text-gray-400 mb-2">
                      This helps your team plan — no judgment, just visibility.
                    </p>
                    <select
                      value={delayReason}
                      onChange={(e) => setDelayReason(e.target.value)}
                      className="w-full border border-amber-200 bg-amber-50 rounded-xl px-3 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      autoFocus
                    >
                      <option value="">Pick a reason…</option>
                      {DELAY_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                )}

                {/* Text note */}
                <div className={action !== "delayed" ? "pt-3" : ""}>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    {action === "delivered" && <>What was delivered? <span className="text-red-500">*</span></>}
                    {action === "on_track"  && <>What&rsquo;s your next concrete step? <span className="text-red-500">*</span></>}
                    {action === "delayed"   && "Any extra context? (optional)"}
                    {action === "blocked"   && <>What exactly is blocking you? <span className="text-red-500">*</span></>}
                  </label>
                  {action === "on_track" && (
                    <p className="text-xs text-gray-400 mb-1.5">
                      Be specific — e.g. &ldquo;Will share first draft with team by Thursday&rdquo;
                    </p>
                  )}
                  {action === "blocked" && (
                    <p className="text-xs text-gray-400 mb-1.5">
                      Name the person or thing blocking you so the right help can reach you.
                    </p>
                  )}
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={
                      action === "delivered" ? "e.g. Sent pricing deck to client on 21 Mar" :
                      action === "on_track"  ? "e.g. Will complete first draft by Thursday" :
                      action === "delayed"   ? "e.g. Client approval expected by 28 Mar" :
                      "e.g. Need finance sign-off from Sandeep before I can proceed"
                    }
                    className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    autoFocus={action !== "delayed"}
                  />
                </div>

                {/* New date (delayed only) */}
                {action === "delayed" && (
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">New target date (optional)</label>
                    <input
                      type="date"
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                )}

                {/* Submit */}
                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit || submitting}
                  className={`w-full text-white py-3 rounded-xl text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${
                    action === "delivered" ? "bg-green-600 hover:bg-green-700" :
                    action === "on_track"  ? "bg-indigo-600 hover:bg-indigo-700" :
                    action === "delayed"   ? "bg-amber-500 hover:bg-amber-600" :
                    "bg-red-500 hover:bg-red-600"
                  }`}
                >
                  {submitting ? "Submitting…" :
                    action === "delivered" ? "Confirm Delivered" :
                    action === "on_track"  ? "Log Next Step →"   :
                    action === "delayed"   ? "Submit Delay"       :
                    "Report Blocker"}
                </button>

                <p className="text-xs text-center text-gray-400 pb-1">
                  Your update is visible to the team immediately.
                </p>
              </div>
            )}
          </div>
        )}

        <p className="text-center text-xs text-gray-300 pt-2 pb-6">Partnr Execution OS · Internal tool</p>
      </div>
    </div>
  );
}
