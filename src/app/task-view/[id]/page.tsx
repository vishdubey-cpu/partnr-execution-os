"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, Clock, AlertCircle, Calendar, User } from "lucide-react";

interface Task {
  id: string;
  title: string;
  description: string;
  owner: string;
  dueDate: string | null;
  status: string;
  priority: string;
  function: string;
}

export default function TaskViewPage({ params }: { params: { id: string } }) {
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [done, setDone] = useState(false);
  const [comment, setComment] = useState("");
  const [commentName, setCommentName] = useState("");
  const [commentSent, setCommentSent] = useState(false);

  useEffect(() => {
    fetch(`/api/tasks/${params.id}`)
      .then((r) => r.json())
      .then((d) => { setTask(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [params.id]);

  async function markDone() {
    setUpdating(true);
    await fetch(`/api/tasks/${params.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "DONE" }),
    });
    setDone(true);
    setUpdating(false);
    if (task) setTask({ ...task, status: "DONE" });
  }

  async function sendComment() {
    if (!comment.trim() || !commentName.trim()) return;
    setUpdating(true);
    await fetch(`/api/tasks/${params.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: commentName, content: comment }),
    });
    setCommentSent(true);
    setComment("");
    setUpdating(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-500">Task not found.</p>
      </div>
    );
  }

  const due = task.dueDate
    ? new Date(task.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : null;

  const statusColor =
    task.status === "DONE" ? "bg-green-100 text-green-700" :
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
            <h1 className="text-base font-semibold text-gray-900 leading-snug">
              {task.title}
            </h1>
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

        {/* Actions */}
        {task.status !== "DONE" && !done && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Update status</p>
            <button
              onClick={markDone}
              disabled={updating}
              className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              <CheckCircle2 size={15} />
              {updating ? "Updating…" : "Mark as Done"}
            </button>
          </div>
        )}

        {done && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-4 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-green-600" />
            <p className="text-sm text-green-700 font-medium">Marked as done. Thank you!</p>
          </div>
        )}

        {/* Comment */}
        {!commentSent ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <p className="text-sm font-medium text-gray-700 mb-3">Add an update or comment</p>
            <input
              value={commentName}
              onChange={(e) => setCommentName(e.target.value)}
              placeholder="Your name"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="e.g. Done, will share by EOD. / Need 2 more days."
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-none"
            />
            <button
              onClick={sendComment}
              disabled={!comment.trim() || !commentName.trim() || updating}
              className="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              Send Update
            </button>
          </div>
        ) : (
          <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex items-center gap-2">
            <AlertCircle size={16} className="text-indigo-600" />
            <p className="text-sm text-indigo-700 font-medium">Update sent. Thank you!</p>
          </div>
        )}

        <p className="text-center text-xs text-gray-300 mt-6">
          Partnr Execution OS · Internal tool
        </p>
      </div>
    </div>
  );
}
