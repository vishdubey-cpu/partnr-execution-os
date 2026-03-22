"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ExtractedTask } from "@/types";
import { FUNCTIONS } from "@/lib/utils";
import {
  NotebookText, Sparkles, Save, AlertCircle, CheckCircle2,
  Calendar, ChevronDown, ChevronUp, User, Quote,
} from "lucide-react";

interface ExtractState {
  meetingNoteId: string;
  tasks: (ExtractedTask & { selected: boolean; sendCalendarInvite: boolean; calendarAttendees: string; _key: number; _expanded: boolean })[];
  provider: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-700 border-red-200",
  HIGH:     "bg-orange-100 text-orange-700 border-orange-200",
  MEDIUM:   "bg-amber-100 text-amber-700 border-amber-200",
  LOW:      "bg-gray-100 text-gray-500 border-gray-200",
};

export default function MeetingNotesPage() {
  const router = useRouter();

  const [meetingName, setMeetingName] = useState("");
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split("T")[0]);
  const [rawNotes, setRawNotes] = useState("");

  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [extracted, setExtracted] = useState<ExtractState | null>(null);
  const [savedCount, setSavedCount] = useState<number | null>(null);

  async function runExtraction(notes: string, name: string, date: string) {
    setError(""); setSavedCount(null);
    setExtracting(true);
    try {
      const res = await fetch("/api/meeting-notes/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingName: name, meetingDate: date, rawNotes: notes }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Extraction failed"); }
      const data = await res.json();
      const sorted = [...data.tasks].sort((a: ExtractedTask, b: ExtractedTask) =>
        (a.ownerName || "").localeCompare(b.ownerName || "")
      );
      setExtracted({
        meetingNoteId: data.meetingNoteId,
        provider: data.provider,
        tasks: sorted.map((t: ExtractedTask, i: number) => ({
          ...t,
          selected: true,
          sendCalendarInvite: false,
          calendarAttendees: t.ownerEmail || "",
          _key: i,
          _expanded: false,
        })),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setExtracting(false);
    }
  }

  // Auto-extract when redirected from home page with pendingNotes
  useEffect(() => {
    const pending = sessionStorage.getItem("pendingNotes");
    if (pending) {
      sessionStorage.removeItem("pendingNotes");
      setRawNotes(pending);
      runExtraction(pending, meetingName, meetingDate);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleExtract(e: React.FormEvent) {
    e.preventDefault();
    if (!rawNotes.trim()) { setError("Please paste your meeting notes."); return; }
    await runExtraction(rawNotes, meetingName, meetingDate);
  }

  function updateTask(key: number, field: string, value: string | boolean) {
    setExtracted((prev) =>
      prev ? { ...prev, tasks: prev.tasks.map((t) => t._key === key ? { ...t, [field]: value } : t) } : prev
    );
  }

  function toggleExpanded(key: number) {
    setExtracted((prev) =>
      prev ? { ...prev, tasks: prev.tasks.map((t) => t._key === key ? { ...t, _expanded: !t._expanded } : t) } : prev
    );
  }

  function toggleAll(selected: boolean) {
    setExtracted((prev) => prev ? { ...prev, tasks: prev.tasks.map((t) => ({ ...t, selected })) } : prev);
  }

  async function handleSave() {
    if (!extracted) return;
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/meeting-notes/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingNoteId: extracted.meetingNoteId, meetingName, meetingDate, tasks: extracted.tasks }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Save failed"); }
      const result = await res.json();
      setSavedCount(result.saved);
      setTimeout(() => router.push("/tasks"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const selectedTasks = extracted?.tasks.filter((t) => t.selected) || [];
  const selectedCount = selectedTasks.length;
  const calendarCount = selectedTasks.filter((t) => t.sendCalendarInvite && t.ownerEmail && t.dueDate).length;

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="mb-5 flex items-center gap-2">
        <NotebookText size={20} className="text-indigo-500" />
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Meeting Notes</h1>
          <p className="text-sm text-gray-500">Paste meeting notes to extract action items and create tasks automatically</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          <AlertCircle size={14} className="flex-shrink-0" /> {error}
        </div>
      )}
      {savedCount !== null && (
        <div className="mb-4 flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-lg">
          <CheckCircle2 size={14} className="flex-shrink-0" />
          {savedCount} task{savedCount !== 1 ? "s" : ""} created successfully! Redirecting to tasks...
        </div>
      )}

      <div className="grid grid-cols-5 gap-5">
        {/* ── Left: Input form ── */}
        <div className="col-span-2">
          <form onSubmit={handleExtract} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">Meeting Details</h2>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Meeting Name <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input value={meetingName} onChange={(e) => setMeetingName(e.target.value)}
                placeholder="e.g. Leadership Weekly Sync"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Meeting Date <span className="text-red-500">*</span>
              </label>
              <input type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Raw Meeting Notes <span className="text-red-500">*</span>
              </label>
              <textarea value={rawNotes} onChange={(e) => setRawNotes(e.target.value)} rows={16}
                placeholder={`Paste your meeting transcript or notes here.\n\nFor best results include:\n• Names of people responsible for actions\n• Deadlines — "by Monday", "by 30 Mar"\n• Specific deliverables, not vague instructions`}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none leading-relaxed" />
            </div>
            <button type="submit" disabled={extracting}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-3 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              <Sparkles size={14} />
              {extracting ? "Extracting with AI…" : "Extract Tasks"}
            </button>
          </form>
        </div>

        {/* ── Right: Extracted tasks ── */}
        <div className="col-span-3">
          {!extracted ? (
            <div className="bg-white rounded-xl border border-gray-200 h-full flex items-center justify-center">
              <div className="text-center py-20">
                <Sparkles size={36} className="text-gray-200 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-400">Extracted tasks will appear here</p>
                <p className="text-xs text-gray-300 mt-1">Paste notes and click &ldquo;Extract Tasks&rdquo;</p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 flex flex-col">
              {/* Header */}
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-gray-800">
                    {extracted.tasks.length} tasks extracted
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    via <span className="font-medium text-indigo-500">{extracted.provider}</span> · {selectedCount} selected
                    {calendarCount > 0 && <span className="text-indigo-500"> · 📅 {calendarCount} invites queued</span>}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => toggleAll(true)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Select all</button>
                  <span className="text-gray-300">·</span>
                  <button onClick={() => toggleAll(false)} className="text-xs text-gray-500 hover:text-gray-700">Deselect all</button>
                </div>
              </div>

              {/* Task list */}
              <div className="divide-y divide-gray-100 max-h-[680px] overflow-y-auto">
                {extracted.tasks.map((task) => (
                  <div key={task._key}
                    className={`transition-colors ${task.selected ? "bg-white" : "bg-gray-50 opacity-55"}`}>

                    {/* ── Task header row ── */}
                    <div className="px-4 pt-4 pb-2 flex items-start gap-3">
                      {/* Select checkbox */}
                      <input type="checkbox" checked={task.selected}
                        onChange={(e) => updateTask(task._key, "selected", e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer flex-shrink-0" />

                      <div className="flex-1 min-w-0">
                        {/* Badges row */}
                        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                          {task.needsReview && (
                            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200 font-medium">
                              ⚠ Needs review
                            </span>
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.MEDIUM}`}>
                            {task.priority}
                          </span>
                          {task.function && (
                            <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full border border-indigo-100">
                              {task.function}
                            </span>
                          )}
                          <span className="text-xs text-gray-400 ml-auto">
                            {Math.round(task.confidenceScore * 100)}% confidence
                          </span>
                        </div>

                        {/* Editable title */}
                        <input value={task.title}
                          onChange={(e) => updateTask(task._key, "title", e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white mb-2" />

                        {/* Context block — description from AI */}
                        {task.description && (
                          <div className="flex items-start gap-2 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 mb-2">
                            <span className="text-indigo-400 mt-0.5 flex-shrink-0">✦</span>
                            <p className="text-xs text-indigo-700 leading-relaxed">{task.description}</p>
                          </div>
                        )}

                        {/* Source quote from meeting notes */}
                        {task.sourceText && (
                          <div className="flex items-start gap-2 bg-slate-50 border-l-4 border-slate-300 rounded-r-lg px-3 py-2 mb-2">
                            <Quote size={11} className="text-slate-400 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-slate-500 italic leading-relaxed">&ldquo;{task.sourceText}&rdquo;</p>
                          </div>
                        )}

                        {/* Fields grid */}
                        <div className="grid grid-cols-6 gap-2 mb-2">
                          <div className="col-span-1">
                            <label className="block text-xs text-gray-400 mb-0.5 flex items-center gap-1"><User size={9} /> Owner</label>
                            <input value={task.ownerName}
                              onChange={(e) => updateTask(task._key, "ownerName", e.target.value)}
                              placeholder="Name"
                              className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                          </div>
                          <div className="col-span-1">
                            <label className="block text-xs text-gray-400 mb-0.5">WhatsApp</label>
                            <input value={task.ownerPhone}
                              onChange={(e) => updateTask(task._key, "ownerPhone", e.target.value)}
                              placeholder="+91..."
                              className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-xs text-gray-400 mb-0.5">Email</label>
                            <input type="email" value={task.ownerEmail || ""}
                              onChange={(e) => updateTask(task._key, "ownerEmail", e.target.value)}
                              placeholder="name@company.com"
                              className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                          </div>
                          <div className="col-span-1">
                            <label className="block text-xs text-gray-400 mb-0.5">Due Date</label>
                            <input type="date" value={task.dueDate}
                              onChange={(e) => updateTask(task._key, "dueDate", e.target.value)}
                              className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                          </div>
                          <div className="col-span-1">
                            <label className="block text-xs text-gray-400 mb-0.5">Priority</label>
                            <select value={task.priority}
                              onChange={(e) => updateTask(task._key, "priority", e.target.value)}
                              className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400">
                              <option value="LOW">Low</option>
                              <option value="MEDIUM">Medium</option>
                              <option value="HIGH">High</option>
                              <option value="CRITICAL">Critical</option>
                            </select>
                          </div>
                        </div>

                        {/* Function + Expand toggle */}
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <select value={task.function}
                              onChange={(e) => updateTask(task._key, "function", e.target.value)}
                              className="border border-gray-200 rounded-md px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400">
                              <option value="">— Function —</option>
                              {FUNCTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                            </select>
                          </div>

                          {/* Calendar invite toggle */}
                          <button
                            type="button"
                            onClick={() => toggleExpanded(task._key)}
                            className="flex items-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-700 font-medium border border-indigo-200 hover:border-indigo-400 rounded-md px-2.5 py-1.5 transition-colors bg-indigo-50 hover:bg-indigo-100"
                          >
                            <Calendar size={11} />
                            {task.sendCalendarInvite ? "Invite set ✓" : "Add calendar invite"}
                            {task._expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                          </button>
                        </div>

                        {/* ── Calendar invite panel (expandable) ── */}
                        {task._expanded && (
                          <div className="mt-2 bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
                            <div className="flex items-center gap-2">
                              <Calendar size={14} className="text-indigo-500" />
                              <p className="text-xs font-bold text-indigo-800">Calendar Invite</p>
                            </div>

                            {/* Toggle */}
                            <label className="flex items-center gap-2.5 cursor-pointer">
                              <div className="relative">
                                <input type="checkbox"
                                  checked={task.sendCalendarInvite}
                                  onChange={(e) => updateTask(task._key, "sendCalendarInvite", e.target.checked)}
                                  className="sr-only" />
                                <div className={`w-9 h-5 rounded-full transition-colors ${task.sendCalendarInvite ? "bg-indigo-600" : "bg-gray-300"}`} />
                                <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${task.sendCalendarInvite ? "translate-x-4" : ""}`} />
                              </div>
                              <span className="text-xs font-medium text-indigo-700">
                                {task.sendCalendarInvite ? "📅 Sending invite to owner" : "Send calendar invite to owner"}
                              </span>
                            </label>

                            {task.sendCalendarInvite && (
                              <div className="space-y-2">
                                {/* Pre-populated summary */}
                                <div className="bg-white rounded-lg border border-indigo-200 p-3 space-y-1.5 text-xs text-gray-600">
                                  <div className="flex gap-2"><span className="font-semibold text-gray-500 w-20 flex-shrink-0">Title:</span><span>[Partnr] {task.title}</span></div>
                                  <div className="flex gap-2"><span className="font-semibold text-gray-500 w-20 flex-shrink-0">Due date:</span><span className="text-red-600 font-medium">{task.dueDate || "—"}</span></div>
                                  <div className="flex gap-2"><span className="font-semibold text-gray-500 w-20 flex-shrink-0">To:</span><span>{task.ownerName} &lt;{task.ownerEmail || "no email set"}&gt;</span></div>
                                  <div className="flex gap-2"><span className="font-semibold text-gray-500 w-20 flex-shrink-0">Context:</span><span className="italic text-slate-500">{task.description || "—"}</span></div>
                                </div>

                                {/* Extra attendees */}
                                <div>
                                  <label className="block text-xs font-medium text-indigo-700 mb-1">
                                    Additional attendees <span className="font-normal text-indigo-400">(comma-separated emails)</span>
                                  </label>
                                  <input
                                    type="text"
                                    value={task.calendarAttendees || ""}
                                    onChange={(e) => updateTask(task._key, "calendarAttendees", e.target.value)}
                                    placeholder="manager@company.com, peer@company.com"
                                    className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                  />
                                </div>

                                {!task.ownerEmail && (
                                  <p className="text-xs text-amber-600 font-medium">⚠ Enter owner email above to send the invite</p>
                                )}
                                {!task.dueDate && (
                                  <p className="text-xs text-amber-600 font-medium">⚠ Set a due date above for the calendar event</p>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Bottom spacing */}
                    <div className="pb-2" />
                  </div>
                ))}
              </div>

              {/* ── Save footer ── */}
              <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 rounded-b-xl flex items-center justify-between">
                <div className="text-xs text-gray-500 space-y-0.5">
                  <p>{selectedCount} task{selectedCount !== 1 ? "s" : ""} will be saved. Tasks without a due date will be skipped.</p>
                  {calendarCount > 0 && (
                    <p className="text-indigo-500 font-medium">📅 {calendarCount} calendar invite{calendarCount !== 1 ? "s" : ""} will be sent to owners</p>
                  )}
                </div>
                <button onClick={handleSave} disabled={saving || selectedCount === 0}
                  className="flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  <Save size={14} />
                  {saving ? "Saving…" : `Save ${selectedCount} Task${selectedCount !== 1 ? "s" : ""}`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
