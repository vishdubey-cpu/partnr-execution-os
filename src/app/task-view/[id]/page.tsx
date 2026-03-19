"use client";

import { useState, useEffect, useRef } from "react";
import { CheckCircle2, Clock, AlertTriangle, Calendar, User } from "lucide-react";

interface Task {
  id: string;
  title: string;
  description: string;
  owner: string;
  dueDate: string | null;
  status: string;
}

type Action = "delivered" | "delayed" | "blocked" | null;

export default function TaskViewPage({ params }: { params: { id: string } }) {
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<Action>(null);
  const [action, setAction] = useState<Action>(null);
  const [note, setNote] = useState("");
  const [newDate, setNewDate] = useState("");
  const pageLoadTime = useRef(Date.now());

  useEffect(() => {
    fetch(`/api/tasks/${params.id}`)
      .then((r) => r.json())
      .then((d) => { setTask(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [params.id]);

  function selectAction(a: Action) {
    setAction(action === a ? null : a);
    setNote("");
    setNewDate("");
  }

  async function handleSubmit() {
    if (!task || !note.trim()) return;
    setSubmitting(true);

    const secondsOnPage = Math.floor((Date.now() - pageLoadTime.current) / 1000);
    const quickClose = secondsOnPage < 60;

    const newStatus = action === "delivered" ? "DONE" : "DELAYED";

    await fetch(`/api/tasks/${params.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: newStatus,
        note,
        action,
        quickClose,
        ...(newDate ? { newDueDate: newDate } : {}),
      }),
    });

    setSubmitted(action);
    setSubmitting(false);
  }

  const notePlaceholder =
    action === "delivered" ? "e.g. Sent pricing deck to client on 21 Mar" :
    action === "delayed"   ? "e.g. Waiting for client approval, should close by 28 Mar" :
    action === "blocked"   ? "e.g. Need finance sign-off from Sandeep before I can proceed" : "";

  const noteLabel =
    action === "delivered" ? "What was delivered? (one line)" :
    action === "delayed"   ? "Why delayed? (one line)" :
    action === "blocked"   ? "What is blocking you? (one line)" : "";

  const canSubmit = note.trim().length >= 5;

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-sm text-gray-400">Loading…</p>
    </div>
  );

  if (!task) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-sm text-gray-500">Task not found.</p>
    </div>
  );

  const due = task.dueDate
    ? new Date(task.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : null;

  const statusColor =
    task.status === "DONE"    ? "bg-green-100 text-green-700" :
    task.status === "DELAYED" ? "bg-amber-100 text-amber-700" :
    "bg-blue-100 text-blue-700";

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="flex items-center gap-2 mb-6 justify-center">
          <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center">
            <span className="text-white text-xs font-bold">P</span>
          </div>
          <span className="text-sm font-medium text-gray-500">Partnr · Task Update</span>
        </div>

        {/* Task card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-4">
          <div className="flex items-start justify-between gap-3 mb-4">
            <h1 className="text-base font-semibold text-gray-900 leading-snug">{task.title}</h1>
            <span className={`text-xs font-medium px-2 py-1 rounded-full flex-shrink-0 ${statusColor}`}>
              {task.status}
            </span>
          </div>
          {task.description && (
            <p className="text-sm text-gray-500 mb-4">{task.description}</p>
          )}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <User size={14} className="text-gray-400" />
              <span>{task.owner || "Unassigned"}</span>
            </div>
            {due && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar size={14} className="text-gray-400" />
                <span>Due {due}</span>
              </div>
            )}
          </div>
        </div>

        {/* Already done */}
        {task.status === "DONE" && !submitted && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-green-600" />
            <p className="text-sm text-green-700 font-medium">This task is already marked delivered.</p>
          </div>
        )}

        {/* Success states */}
        {submitted === "delivered" && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
            <CheckCircle2 size={28} className="text-green-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-green-800">Delivered — update recorded.</p>
            <p className="text-xs text-green-600 mt-1">Your update has been shared with the team.</p>
          </div>
        )}
        {submitted === "delayed" && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center">
            <Clock size={28} className="text-amber-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-amber-800">Delay noted — team has been informed.</p>
          </div>
        )}
        {submitted === "blocked" && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center">
            <AlertTriangle size={28} className="text-red-500 mx-auto mb-2" />
            <p className="text-sm font-semibold text-red-800">Blocker reported — team has been alerted.</p>
          </div>
        )}

        {/* Action panel */}
        {task.status !== "DONE" && !submitted && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <p className="text-sm font-semibold text-gray-700 mb-1">Update status</p>
            <p className="text-xs text-gray-400 mb-4">Your response will be visible to the team.</p>

            {/* 3 options */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <button
                onClick={() => selectAction("delivered")}
                className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border text-xs font-semibold transition-all ${
                  action === "delivered"
                    ? "bg-green-600 border-green-600 text-white"
                    : "border-gray-200 text-gray-600 hover:border-green-400 hover:text-green-700 hover:bg-green-50"
                }`}
              >
                <CheckCircle2 size={18} />
                Delivered
              </button>
              <button
                onClick={() => selectAction("delayed")}
                className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border text-xs font-semibold transition-all ${
                  action === "delayed"
                    ? "bg-amber-500 border-amber-500 text-white"
                    : "border-gray-200 text-gray-600 hover:border-amber-400 hover:text-amber-700 hover:bg-amber-50"
                }`}
              >
                <Clock size={18} />
                Delayed
              </button>
              <button
                onClick={() => selectAction("blocked")}
                className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border text-xs font-semibold transition-all ${
                  action === "blocked"
                    ? "bg-red-500 border-red-500 text-white"
                    : "border-gray-200 text-gray-600 hover:border-red-400 hover:text-red-700 hover:bg-red-50"
                }`}
              >
                <AlertTriangle size={18} />
                Blocked
              </button>
            </div>

            {/* Note input — shown when action selected */}
            {action && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {noteLabel} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={notePlaceholder}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    autoFocus
                  />
                </div>

                {/* New date — only for delayed */}
                {action === "delayed" && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      New deadline (optional)
                    </label>
                    <input
                      type="date"
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit || submitting}
                  className={`w-full text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${
                    action === "delivered" ? "bg-green-600 hover:bg-green-700" :
                    action === "delayed"   ? "bg-amber-500 hover:bg-amber-600" :
                    "bg-red-500 hover:bg-red-600"
                  }`}
                >
                  {submitting ? "Submitting…" :
                    action === "delivered" ? "Confirm Delivered" :
                    action === "delayed"   ? "Submit Delay" :
                    "Report Blocker"}
                </button>
              </div>
            )}
          </div>
        )}

        <p className="text-center text-xs text-gray-300 mt-6">Partnr Execution OS · Internal tool</p>
      </div>
    </div>
  );
}
