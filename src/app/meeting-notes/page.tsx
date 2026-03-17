"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExtractedTask } from "@/types";
import { FUNCTIONS, SOURCES } from "@/lib/utils";
import { NotebookText, Sparkles, Save, AlertCircle, CheckCircle2 } from "lucide-react";

interface ExtractState {
  meetingNoteId: string;
  tasks: (ExtractedTask & { selected: boolean; _key: number })[];
  provider: string;
}

export default function MeetingNotesPage() {
  const router = useRouter();

  // Form state
  const [meetingName, setMeetingName] = useState("");
  const [meetingDate, setMeetingDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [rawNotes, setRawNotes] = useState("");

  // UI state
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [extracted, setExtracted] = useState<ExtractState | null>(null);
  const [savedCount, setSavedCount] = useState<number | null>(null);

  async function handleExtract(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSavedCount(null);

    if (!meetingName || !meetingDate || !rawNotes.trim()) {
      setError("Meeting name, date, and notes are required.");
      return;
    }

    setExtracting(true);
    try {
      const res = await fetch("/api/meeting-notes/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingName, meetingDate, rawNotes }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Extraction failed");
      }
      const data = await res.json();
      setExtracted({
        meetingNoteId: data.meetingNoteId,
        provider: data.provider,
        tasks: data.tasks.map((t: ExtractedTask, i: number) => ({
          ...t,
          selected: true,
          _key: i,
        })),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setExtracting(false);
    }
  }

  function updateTask(key: number, field: string, value: string | boolean) {
    setExtracted((prev) =>
      prev
        ? {
            ...prev,
            tasks: prev.tasks.map((t) =>
              t._key === key ? { ...t, [field]: value } : t
            ),
          }
        : prev
    );
  }

  function toggleAll(selected: boolean) {
    setExtracted((prev) =>
      prev ? { ...prev, tasks: prev.tasks.map((t) => ({ ...t, selected })) } : prev
    );
  }

  async function handleSave() {
    if (!extracted) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/meeting-notes/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingNoteId: extracted.meetingNoteId,
          meetingName,
          meetingDate,
          tasks: extracted.tasks,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Save failed");
      }
      const result = await res.json();
      setSavedCount(result.saved);
      setTimeout(() => router.push("/tasks"), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const selectedCount = extracted?.tasks.filter((t) => t.selected).length || 0;

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="mb-5 flex items-center gap-2">
        <NotebookText size={20} className="text-indigo-500" />
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Meeting Notes</h1>
          <p className="text-sm text-gray-500">
            Paste meeting notes to extract action items and create tasks automatically
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {savedCount !== null && (
        <div className="mb-4 flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded">
          <CheckCircle2 size={14} />
          {savedCount} task{savedCount !== 1 ? "s" : ""} created successfully! Redirecting...
        </div>
      )}

      <div className="grid grid-cols-5 gap-5">
        {/* Left: Input form */}
        <div className="col-span-2">
          <form onSubmit={handleExtract} className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">Meeting Details</h2>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Meeting Name <span className="text-red-500">*</span>
              </label>
              <input
                value={meetingName}
                onChange={(e) => setMeetingName(e.target.value)}
                placeholder="e.g. Leadership Weekly Sync"
                className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Meeting Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Raw Meeting Notes <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rawNotes}
                onChange={(e) => setRawNotes(e.target.value)}
                rows={16}
                placeholder={`Paste your meeting notes here. For best results include:\n• Action items with owner names\n• Lines like "Priya to finalize hiring plan by 22 Mar"\n• Todo lists, numbered items\n• Deadlines and priorities`}
                className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-mono text-xs leading-relaxed"
              />
            </div>

            <button
              type="submit"
              disabled={extracting}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Sparkles size={14} />
              {extracting ? "Extracting tasks..." : "Extract Tasks"}
            </button>
          </form>
        </div>

        {/* Right: Extracted tasks */}
        <div className="col-span-3">
          {!extracted ? (
            <div className="bg-white rounded-lg border border-gray-200 h-full flex items-center justify-center">
              <div className="text-center py-16">
                <Sparkles size={32} className="text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">Extracted tasks will appear here</p>
                <p className="text-xs text-gray-300 mt-1">
                  Paste notes and click &ldquo;Extract Tasks&rdquo;
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200">
              {/* Header */}
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-gray-800">
                    {extracted.tasks.length} tasks extracted
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Provider: {extracted.provider} · {selectedCount} selected
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleAll(true)}
                    className="text-xs text-indigo-600 hover:text-indigo-700"
                  >
                    Select all
                  </button>
                  <span className="text-gray-300">·</span>
                  <button
                    onClick={() => toggleAll(false)}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Deselect all
                  </button>
                </div>
              </div>

              {/* Task list */}
              <div className="divide-y divide-gray-50 max-h-[640px] overflow-y-auto">
                {extracted.tasks.map((task) => (
                  <div
                    key={task._key}
                    className={`p-4 transition-colors ${
                      task.selected ? "bg-white" : "bg-gray-50 opacity-60"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={task.selected}
                        onChange={(e) => updateTask(task._key, "selected", e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />

                      <div className="flex-1 min-w-0 space-y-2">
                        {/* Title */}
                        <div className="flex items-start gap-2">
                          <input
                            value={task.title}
                            onChange={(e) => updateTask(task._key, "title", e.target.value)}
                            className="flex-1 border border-gray-200 rounded px-2.5 py-1 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          />
                          {task.needsReview && (
                            <span className="flex-shrink-0 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                              Needs review
                            </span>
                          )}
                          <span className="text-xs text-gray-400 flex-shrink-0">
                            {Math.round(task.confidenceScore * 100)}% confidence
                          </span>
                        </div>

                        {/* Row: Owner, Phone, Due, Priority, Function */}
                        <div className="grid grid-cols-5 gap-2">
                          <div>
                            <label className="block text-xs text-gray-400 mb-0.5">Owner</label>
                            <input
                              value={task.ownerName}
                              onChange={(e) => updateTask(task._key, "ownerName", e.target.value)}
                              placeholder="Owner name"
                              className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-400 mb-0.5">Phone</label>
                            <input
                              value={task.ownerPhone}
                              onChange={(e) => updateTask(task._key, "ownerPhone", e.target.value)}
                              placeholder="+91..."
                              className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-400 mb-0.5">Due Date</label>
                            <input
                              type="date"
                              value={task.dueDate}
                              onChange={(e) => updateTask(task._key, "dueDate", e.target.value)}
                              className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-400 mb-0.5">Priority</label>
                            <select
                              value={task.priority}
                              onChange={(e) => updateTask(task._key, "priority", e.target.value)}
                              className="w-full border border-gray-200 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                            >
                              <option value="LOW">Low</option>
                              <option value="MEDIUM">Medium</option>
                              <option value="HIGH">High</option>
                              <option value="CRITICAL">Critical</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-400 mb-0.5">Function</label>
                            <select
                              value={task.function}
                              onChange={(e) => updateTask(task._key, "function", e.target.value)}
                              className="w-full border border-gray-200 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                            >
                              <option value="">—</option>
                              {FUNCTIONS.map((f) => (
                                <option key={f} value={f}>{f}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Save footer */}
              <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50 rounded-b-lg">
                <p className="text-xs text-gray-500">
                  {selectedCount} task{selectedCount !== 1 ? "s" : ""} will be saved.
                  Tasks without a due date will be skipped.
                </p>
                <button
                  onClick={handleSave}
                  disabled={saving || selectedCount === 0}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Save size={14} />
                  {saving ? "Saving..." : `Save ${selectedCount} Task${selectedCount !== 1 ? "s" : ""}`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
