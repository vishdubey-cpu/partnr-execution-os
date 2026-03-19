"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Task } from "@/types";
import { StatusBadge } from "@/components/tasks/StatusBadge";
import { PriorityBadge } from "@/components/tasks/PriorityBadge";
import { ActivityLog } from "@/components/tasks/ActivityLog";
import {
  formatDate,
  formatDateTime,
  getDaysOverdue,
  timeAgo,
  FUNCTIONS,
} from "@/lib/utils";
import {
  ArrowLeft,
  Phone,
  Calendar,
  Tag,
  MessageSquare,
  Send,
  CheckCircle,
  Clock,
  AlertTriangle,
  RotateCcw,
  Trash2,
  MessageCircle,
  ArrowUpCircle,
  Bell,
  Pencil,
} from "lucide-react";
import Link from "next/link";

interface EditForm {
  title: string;
  owner: string;
  dueDate: string;
  ownerPhone: string;
  ownerEmail: string;
  function: string;
  priority: string;
}

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentAuthor, setCommentAuthor] = useState("");
  const [commentContent, setCommentContent] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  // Edit mode state
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({
    title: "",
    owner: "",
    dueDate: "",
    ownerPhone: "",
    ownerEmail: "",
    function: "",
    priority: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  async function fetchTask() {
    try {
      const res = await fetch(`/api/tasks/${id}`);
      if (res.ok) {
        setTask(await res.json());
      } else if (res.status !== 404) {
        setFetchError(true);
      }
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTask();
  }, [id]);

  function enterEditMode() {
    if (!task) return;
    setEditForm({
      title: task.title,
      owner: task.owner,
      dueDate: task.dueDate ? task.dueDate.slice(0, 10) : "",
      ownerPhone: task.ownerPhone || "",
      ownerEmail: task.ownerEmail || "",
      function: task.function || "",
      priority: task.priority,
    });
    setEditMode(true);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    setSavingEdit(true);
    await fetch(`/api/tasks/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editForm.title,
        owner: editForm.owner,
        ownerPhone: editForm.ownerPhone,
        ownerEmail: editForm.ownerEmail,
        function: editForm.function,
        priority: editForm.priority,
        dueDate: editForm.dueDate ? new Date(editForm.dueDate).toISOString() : "",
      }),
    });
    await fetchTask();
    setSavingEdit(false);
    setEditMode(false);
  }

  async function updateStatus(status: string) {
    setUpdatingStatus(true);
    await fetch(`/api/tasks/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await fetchTask();
    setUpdatingStatus(false);
  }

  async function updateEscalation(level: number) {
    await fetch(`/api/tasks/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ escalationLevel: level }),
    });
    await fetchTask();
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentAuthor.trim() || !commentContent.trim()) return;

    setSubmittingComment(true);
    await fetch(`/api/tasks/${id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: commentAuthor, content: commentContent }),
    });
    setCommentContent("");
    await fetchTask();
    setSubmittingComment(false);
  }

  async function deleteTask() {
    if (!confirm("Delete this task? This cannot be undone.")) return;
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    router.push("/tasks");
  }

  if (loading) {
    return (
      <div className="p-6 text-center text-sm text-gray-400">Loading...</div>
    );
  }

  if (fetchError) {
    return (
      <div className="p-6 text-center text-sm text-red-500">
        Failed to load task.{" "}
        <Link href="/tasks" className="text-indigo-600">
          Back to tasks
        </Link>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="p-6 text-center text-sm text-gray-500">
        Task not found.{" "}
        <Link href="/tasks" className="text-indigo-600">
          Back to tasks
        </Link>
      </div>
    );
  }

  const daysOverdue = getDaysOverdue(task.dueDate);

  return (
    <div className="p-4 md:p-6 max-w-screen-lg mx-auto">
      {/* Back */}
      <Link
        href="/tasks"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeft size={14} />
        Back to Tasks
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main content */}
        <div className="col-span-1 lg:col-span-2 space-y-4">
          {/* Task Header */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            {editMode ? (
              /* --- Edit Form --- */
              <form onSubmit={saveEdit} className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Title</label>
                  <input
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    required
                    className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Owner</label>
                    <input
                      value={editForm.owner}
                      onChange={(e) => setEditForm({ ...editForm, owner: e.target.value })}
                      required
                      className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Due Date</label>
                    <input
                      type="date"
                      value={editForm.dueDate}
                      onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
                      className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">WhatsApp</label>
                    <input
                      value={editForm.ownerPhone}
                      onChange={(e) => setEditForm({ ...editForm, ownerPhone: e.target.value })}
                      className="w-full border border-gray-200 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Email (backup)</label>
                    <input
                      type="email"
                      value={editForm.ownerEmail}
                      onChange={(e) => setEditForm({ ...editForm, ownerEmail: e.target.value })}
                      className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Function</label>
                    <select
                      value={editForm.function}
                      onChange={(e) => setEditForm({ ...editForm, function: e.target.value })}
                      className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    >
                      <option value="">— select —</option>
                      {FUNCTIONS.map((fn) => (
                        <option key={fn} value={fn}>{fn}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Priority</label>
                    <select
                      value={editForm.priority}
                      onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                      className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    >
                      {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="px-4 py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    {savingEdit ? "Saving…" : "Save Changes"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditMode(false)}
                    className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              /* --- View Mode --- */
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <h1 className="text-lg font-semibold text-gray-900 leading-snug">
                      {task.title}
                    </h1>
                    {task.description && (
                      <p className="text-sm text-gray-500 mt-2">{task.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <StatusBadge status={task.status} />
                    <PriorityBadge priority={task.priority} />
                    <button
                      onClick={enterEditMode}
                      title="Edit task"
                      className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={deleteTask}
                      title="Delete task"
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Source */}
                {task.source && (
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-400">
                    <Tag size={12} />
                    <span>{task.source}</span>
                  </div>
                )}

                {/* Overdue warning */}
                {daysOverdue > 0 && task.status !== "DONE" && (
                  <div className="mt-3 bg-red-50 border border-red-200 rounded px-3 py-2 flex items-center gap-2">
                    <AlertTriangle size={14} className="text-red-500" />
                    <span className="text-sm text-red-700 font-medium">
                      {daysOverdue} day{daysOverdue !== 1 ? "s" : ""} overdue
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Status Actions */}
          {task.status !== "DONE" && (
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">
                Update Status
              </h2>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => updateStatus("DONE")}
                  disabled={updatingStatus}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  <CheckCircle size={14} />
                  Mark Done
                </button>
                <button
                  onClick={() => updateStatus("DELAYED")}
                  disabled={updatingStatus || task.status === "DELAYED"}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white text-sm rounded hover:bg-amber-600 transition-colors disabled:opacity-50"
                >
                  <Clock size={14} />
                  Mark Delayed
                </button>
                <button
                  onClick={() => updateStatus("OPEN")}
                  disabled={updatingStatus || task.status === "OPEN"}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300 transition-colors disabled:opacity-50"
                >
                  <RotateCcw size={14} />
                  Reopen
                </button>
              </div>
            </div>
          )}

          {/* Comments */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <MessageSquare size={14} />
              Comments ({task.comments?.length || 0})
            </h2>

            {/* Existing comments */}
            {task.comments && task.comments.length > 0 && (
              <div className="space-y-3 mb-4">
                {task.comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="bg-gray-50 rounded p-3 border border-gray-100"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-700">
                        {comment.author}
                      </span>
                      <span className="text-xs text-gray-400">
                        {timeAgo(comment.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{comment.content}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Add comment */}
            <form onSubmit={submitComment} className="space-y-2">
              <input
                value={commentAuthor}
                onChange={(e) => setCommentAuthor(e.target.value)}
                placeholder="Your name"
                className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="flex gap-2">
                <input
                  value={commentContent}
                  onChange={(e) => setCommentContent(e.target.value)}
                  placeholder="Add a comment..."
                  className="flex-1 border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={submittingComment || !commentAuthor || !commentContent}
                  className="px-3 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send size={14} />
                </button>
              </div>
            </form>
          </div>

          {/* Activity Log */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">
              Activity Log
            </h2>
            <ActivityLog activities={task.activities || []} />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Task Info */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
              Task Details
            </h2>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Owner</p>
                <p className="text-sm font-medium text-gray-800">{task.owner}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5 flex items-center gap-1">
                  <Phone size={10} />
                  WhatsApp
                </p>
                <p className="text-sm text-gray-700 font-mono">{task.ownerPhone}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Function</p>
                <p className="text-sm text-gray-700">{task.function}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5 flex items-center gap-1">
                  <Calendar size={10} />
                  Due Date
                </p>
                <p
                  className={`text-sm font-medium ${
                    daysOverdue > 0 && task.status !== "DONE"
                      ? "text-red-600"
                      : "text-gray-700"
                  }`}
                >
                  {formatDate(task.dueDate)}
                </p>
              </div>
              {task.closedAt && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Closed At</p>
                  <p className="text-sm text-gray-700">
                    {formatDate(task.closedAt)}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Created</p>
                <p className="text-sm text-gray-500">
                  {formatDateTime(task.createdAt)}
                </p>
              </div>
            </div>
          </div>

          {/* Escalation */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Escalation Level
            </h2>
            <div className="flex gap-2 mb-3">
              {[0, 1, 2].map((level) => (
                <button
                  key={level}
                  onClick={() => updateEscalation(level)}
                  className={`flex-1 py-1.5 text-sm font-medium rounded transition-colors ${
                    task.escalationLevel === level
                      ? level === 0
                        ? "bg-gray-200 text-gray-700"
                        : level === 1
                        ? "bg-amber-500 text-white"
                        : "bg-red-500 text-white"
                      : "bg-gray-50 text-gray-400 hover:bg-gray-100 border border-gray-200"
                  }`}
                >
                  L{level}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400">
              {task.escalationLevel === 0
                ? "No escalation"
                : task.escalationLevel === 1
                ? "Manager notified"
                : "Senior leadership notified"}
            </p>
          </div>

          {/* Reminder History */}
          {task.reminders && task.reminders.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Bell size={11} />
                Reminder History ({task.reminders.filter((r) => r.type !== "INBOUND_REPLY").length} sent)
              </h2>
              <div className="space-y-2">
                {task.reminders
                  .filter((r) => r.type !== "INBOUND_REPLY")
                  .map((r) => (
                    <div key={r.id} className="text-xs bg-gray-50 rounded p-2 border border-gray-100">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-medium text-indigo-600">{r.type}</span>
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          r.status === "SENT" ? "bg-green-100 text-green-700"
                          : r.status === "FAILED" ? "bg-red-100 text-red-700"
                          : "bg-gray-100 text-gray-600"
                        }`}>
                          {r.status}
                        </span>
                      </div>
                      {r.recipientName && (
                        <p className="text-gray-500">→ {r.recipientName} · {r.provider}</p>
                      )}
                      <p className="text-gray-400 mt-0.5">{timeAgo(r.sentAt)}</p>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* WhatsApp Interactions */}
          {task.reminders && task.reminders.some((r) => r.type === "INBOUND_REPLY") && (
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <MessageCircle size={11} className="text-green-600" />
                WhatsApp Replies
              </h2>
              <div className="space-y-2">
                {task.reminders
                  .filter((r) => r.type === "INBOUND_REPLY")
                  .map((r) => {
                    const meta = r.metadata ? JSON.parse(r.metadata) : {};
                    return (
                      <div key={r.id} className="text-xs bg-green-50 rounded p-2 border border-green-100">
                        <div className="flex items-center justify-between">
                          <span className={`font-semibold ${
                            meta.replyType === "DONE" ? "text-green-700"
                            : meta.replyType === "DELAYED" ? "text-amber-700"
                            : "text-red-700"
                          }`}>
                            {meta.replyType || "REPLY"}
                          </span>
                          <span className="text-gray-400">{timeAgo(r.sentAt)}</span>
                        </div>
                        <p className="text-gray-500 mt-0.5 italic">&ldquo;{r.message}&rdquo;</p>
                        {meta.revisedDate && (
                          <p className="text-gray-500">New date: {meta.revisedDate}</p>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Escalation History */}
          {task.activities && task.activities.some((a) => a.type === "ESCALATION") && (
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <ArrowUpCircle size={11} className="text-red-500" />
                Escalation History
              </h2>
              <div className="space-y-2">
                {task.activities
                  .filter((a) => a.type === "ESCALATION")
                  .map((a) => (
                    <div key={a.id} className="text-xs bg-red-50 rounded p-2 border border-red-100">
                      <p className="text-red-800 font-medium">{a.message}</p>
                      <p className="text-gray-400 mt-0.5">{timeAgo(a.createdAt)}</p>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
