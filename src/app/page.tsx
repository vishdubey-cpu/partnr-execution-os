"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowRight, ArrowLeft, Save, CheckCircle2, AlertCircle } from "lucide-react";
import { ExtractedTask } from "@/types";

// ── Types ──────────────────────────────────────────────────────────────

interface PressureItem {
  id: string;
  title: string;
  owner: string;
  daysOverdue: number;
}

interface HomeData {
  overdueItems: PressureItem[];
  dueTodayCount: number;
}

type ExtractedRow = ExtractedTask & { selected: boolean; _key: number };

type PageState = "capture" | "extracting" | "review" | "saving" | "saved";

// ── Component ──────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter();

  // Capture
  const [input, setInput] = useState("");

  // Pressure radar
  const [pressureData, setPressureData] = useState<HomeData | null>(null);
  const [pressureLoading, setPressureLoading] = useState(true);

  // Extraction flow
  const [pageState, setPageState] = useState<PageState>("capture");
  const [extractedTasks, setExtractedTasks] = useState<ExtractedRow[]>([]);
  const [meetingNoteId, setMeetingNoteId] = useState("");
  const [savedCount, setSavedCount] = useState(0);
  const [error, setError] = useState("");

  // Load pressure radar data
  useEffect(() => {
    fetch("/api/dashboard", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const now = Date.now();
        const overdueItems = (d.overdueTasksSummary || [])
          .slice(0, 4)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((t: any) => ({
            id: t.id,
            title: t.title,
            owner: t.owner,
            daysOverdue: Math.floor(
              (now - new Date(t.dueDate).getTime()) / (1000 * 60 * 60 * 24)
            ),
          }));
        setPressureData({
          overdueItems,
          dueTodayCount: d.dueTodayTasks || 0,
        });
      })
      .catch(() => setPressureData(null))
      .finally(() => setPressureLoading(false));
  }, []);

  // ── Extraction ───────────────────────────────────────────────────────

  async function runExtraction(notes: string) {
    setError("");
    setPageState("extracting");
    try {
      const res = await fetch("/api/meeting-notes/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawNotes: notes,
          meetingDate: new Date().toISOString().split("T")[0],
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Extraction failed");
      }
      const data = await res.json();
      const sorted = [...data.tasks].sort((a: ExtractedTask, b: ExtractedTask) =>
        (a.ownerName || "").localeCompare(b.ownerName || "")
      );
      setMeetingNoteId(data.meetingNoteId);
      const rows = sorted.map((t: ExtractedTask, i: number) => ({
        ...t,
        selected: true,
        _key: i,
      }));
      setExtractedTasks(rows);
      setPageState("review");
      // Auto-fill contact details for each owner from previous tasks
      rows.forEach((t: ExtractedRow) => {
        if (t.ownerName && (!t.ownerPhone || !t.ownerEmail)) {
          lookupOwnerForTask(t._key, t.ownerName);
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extraction failed");
      setPageState("capture");
    }
  }

  function handleCapture() {
    if (!input.trim()) return;
    runExtraction(input.trim());
  }

  function updateTask(key: number, field: string, value: string | boolean) {
    setExtractedTasks((prev) =>
      prev.map((t) => (t._key === key ? { ...t, [field]: value } : t))
    );
  }

  async function lookupOwnerForTask(key: number, ownerName: string) {
    if (!ownerName.trim()) return;
    try {
      const res = await fetch(`/api/owners?name=${encodeURIComponent(ownerName.trim())}`);
      const data = await res.json();
      if (data) {
        setExtractedTasks((prev) =>
          prev.map((t) =>
            t._key === key
              ? {
                  ...t,
                  ownerPhone: t.ownerPhone || data.ownerPhone || "",
                  ownerEmail: t.ownerEmail || data.ownerEmail || "",
                }
              : t
          )
        );
      }
    } catch {
      // silently ignore
    }
  }

  async function handleSave() {
    const selected = extractedTasks.filter((t) => t.selected);
    if (selected.length === 0) return;
    setPageState("saving");
    setError("");
    try {
      const res = await fetch("/api/meeting-notes/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingNoteId,
          meetingName: "",
          meetingDate: new Date().toISOString().split("T")[0],
          tasks: selected,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Save failed");
      }
      const result = await res.json();
      setSavedCount(result.saved);
      setPageState("saved");
      setTimeout(() => {
        setInput("");
        setExtractedTasks([]);
        setPageState("capture");
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setPageState("review");
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const isLong = true; // always extract
  const selectedCount = extractedTasks.filter((t) => t.selected).length;

  // ── Render ───────────────────────────────────────────────────────────

  // ── SAVED confirmation ───────────────────────────────────────────────
  if (pageState === "saved") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <CheckCircle2 size={40} className="text-green-500 mx-auto mb-3" />
          <p className="text-lg font-semibold text-gray-800">
            {savedCount} task{savedCount !== 1 ? "s" : ""} saved
          </p>
          <p className="text-sm text-gray-400 mt-1">Returning to home…</p>
        </div>
      </div>
    );
  }

  // ── EXTRACTING loading state ──────────────────────────────────────────
  if (pageState === "extracting") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Sparkles size={32} className="text-indigo-400 mx-auto mb-3 animate-pulse" />
          <p className="text-sm font-medium text-gray-600">Extracting tasks…</p>
          <p className="text-xs text-gray-400 mt-1">Reading your notes</p>
        </div>
      </div>
    );
  }

  // ── REVIEW extracted tasks ────────────────────────────────────────────
  if (pageState === "review" || pageState === "saving") {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-6 pt-10 pb-12">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <button
                onClick={() => setPageState("capture")}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mb-2 transition-colors"
              >
                <ArrowLeft size={12} /> Back
              </button>
              <h2 className="text-lg font-semibold text-gray-900">
                {extractedTasks.length} tasks extracted
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Review and fix, then save — {selectedCount} selected
              </p>
            </div>
            <button
              onClick={handleSave}
              disabled={pageState === "saving" || selectedCount === 0}
              className="flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save size={14} />
              {pageState === "saving"
                ? "Saving…"
                : `Save ${selectedCount} Task${selectedCount !== 1 ? "s" : ""}`}
            </button>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          {/* Task list */}
          <div className="space-y-3">
            {extractedTasks.map((task) => (
              <div
                key={task._key}
                className={`bg-white rounded-xl border px-4 py-4 transition-all ${
                  task.selected ? "border-gray-200" : "border-gray-100 opacity-50"
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={task.selected}
                    onChange={(e) => updateTask(task._key, "selected", e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 cursor-pointer"
                  />

                  <div className="flex-1 space-y-2.5">
                    {/* Title */}
                    <input
                      value={task.title}
                      onChange={(e) => updateTask(task._key, "title", e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />

                    {/* Owner + Due Date — the two fields that matter */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-400 mb-0.5">Owner</label>
                        <input
                          value={task.ownerName}
                          onChange={(e) => updateTask(task._key, "ownerName", e.target.value)}
                          onBlur={(e) => lookupOwnerForTask(task._key, e.target.value)}
                          placeholder="Owner name"
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-0.5">
                          Due Date{" "}
                          {!task.dueDate && (
                            <span className="text-amber-500">· not detected</span>
                          )}
                        </label>
                        <input
                          type="date"
                          value={task.dueDate}
                          onChange={(e) => updateTask(task._key, "dueDate", e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        />
                      </div>
                    </div>

                    {/* Phone + Email — always visible */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-400 mb-0.5">WhatsApp</label>
                        <input
                          value={task.ownerPhone}
                          onChange={(e) => updateTask(task._key, "ownerPhone", e.target.value)}
                          placeholder="+919876543210"
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-0.5">Email <span className="text-gray-300">(backup)</span></label>
                        <input
                          type="email"
                          value={task.ownerEmail || ""}
                          onChange={(e) => updateTask(task._key, "ownerEmail", e.target.value)}
                          placeholder="priya@company.com"
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom save bar */}
          <div className="mt-5 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              Tasks without a due date will be saved with a 30-day default
            </p>
            <button
              onClick={handleSave}
              disabled={pageState === "saving" || selectedCount === 0}
              className="flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save size={14} />
              {pageState === "saving" ? "Saving…" : `Save ${selectedCount} Tasks`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── CAPTURE (default home) ────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-6 pt-14 pb-12">

        {/* Greeting */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">{greeting}.</h1>
          <p className="text-sm text-gray-400 mt-1">
            {new Date().toLocaleDateString("en-IN", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        {/* Capture Box */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-8">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleCapture();
            }}
            rows={4}
            placeholder={
              "What was decided?\n\ne.g. \"Ravi owns pricing deck by Friday\"\nor paste messy meeting notes — I'll extract the tasks"
            }
            className="w-full px-5 pt-5 pb-2 text-sm text-gray-800 placeholder-gray-300 focus:outline-none rounded-t-xl resize-none leading-relaxed bg-transparent"
            autoFocus
          />
          <div className="px-5 pb-4 pt-1 flex items-center justify-between">
            <p className="text-xs text-gray-300">
              {input.length === 0
                ? "⌘ + Enter to capture"
                : "Claude will extract owner, date, and task"}
            </p>
            <button
              onClick={handleCapture}
              disabled={!input.trim()}
              className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Sparkles size={13} />
              Extract Tasks
            </button>
          </div>
        </div>

        {/* Pressure Radar */}
        <div className="mb-8">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            needs your attention
          </p>

          {pressureLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-[62px] bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : !pressureData ||
            (pressureData.overdueItems.length === 0 &&
              pressureData.dueTodayCount === 0) ? (
            <div className="bg-white rounded-xl border border-gray-100 px-5 py-8 text-center">
              <p className="text-sm text-gray-400">Nothing urgent right now</p>
              <p className="text-xs text-gray-300 mt-1">
                You&apos;re on top of things ✓
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {pressureData.overdueItems.map((item) => (
                <a
                  key={item.id}
                  href={`/tasks/${item.id}`}
                  className="flex items-center justify-between bg-white rounded-xl border border-gray-100 px-4 py-3.5 hover:border-red-200 hover:bg-red-50 transition-all group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-base flex-shrink-0">
                      {item.daysOverdue >= 3 ? "🔴" : "🟡"}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {item.title}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {item.owner} ·{" "}
                        {item.daysOverdue > 0
                          ? `${item.daysOverdue}d overdue`
                          : "due today"}
                      </p>
                    </div>
                  </div>
                  <ArrowRight
                    size={14}
                    className="text-gray-300 group-hover:text-red-400 flex-shrink-0 ml-3 transition-colors"
                  />
                </a>
              ))}

              {pressureData.dueTodayCount > 0 && (
                <a
                  href="/tasks"
                  className="flex items-center justify-between bg-white rounded-xl border border-amber-100 px-4 py-3.5 hover:bg-amber-50 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-base">🟡</span>
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">
                        {pressureData.dueTodayCount} task
                        {pressureData.dueTodayCount > 1 ? "s" : ""}
                      </span>{" "}
                      due today
                    </p>
                  </div>
                  <ArrowRight
                    size={14}
                    className="text-gray-300 group-hover:text-amber-400 flex-shrink-0 transition-colors"
                  />
                </a>
              )}
            </div>
          )}
        </div>

        {/* Footer links */}
        <div className="flex items-center justify-between">
          <a
            href="/meeting-notes"
            className="text-xs text-indigo-500 hover:text-indigo-700 font-medium flex items-center gap-1.5 transition-colors"
          >
            <Sparkles size={11} />
            Full meeting notes editor
          </a>
          <a
            href="/dashboard"
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1.5 transition-colors"
          >
            Full dashboard
            <ArrowRight size={11} />
          </a>
        </div>
      </div>
    </div>
  );
}
