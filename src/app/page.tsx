"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowRight, AlertCircle } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────

interface PressureItem {
  id: string;
  title: string;
  owner: string;
  daysOverdue: number;
}

interface HomeData {
  overdueItems: PressureItem[];
  dueSoonItems: PressureItem[];
  dueTodayCount: number;
}

// ── Component ──────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter();

  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  // Pressure radar
  const [pressureData, setPressureData] = useState<HomeData | null>(null);
  const [pressureLoading, setPressureLoading] = useState(true);

  // Load pressure radar data
  useEffect(() => {
    fetch("/api/dashboard", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const now = Date.now();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const overdueItems = (d.overdueTasksSummary || []).slice(0, 4).map((t: any) => ({
          id: t.id,
          title: t.title,
          owner: t.owner,
          daysOverdue: Math.floor(
            (now - new Date(t.dueDate).getTime()) / (1000 * 60 * 60 * 24)
          ),
        }));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const dueSoonItems = (d.dueSoonSummary || []).slice(0, 3).map((t: any) => ({
          id: t.id,
          title: t.title,
          owner: t.owner,
          daysOverdue: -Math.ceil(
            (new Date(t.dueDate).getTime() - now) / (1000 * 60 * 60 * 24)
          ),
        }));
        setPressureData({
          overdueItems,
          dueSoonItems,
          dueTodayCount: d.dueTodayTasks || 0,
        });
      })
      .catch(() => setPressureData(null))
      .finally(() => setPressureLoading(false));
  }, []);

  // ── Capture → redirect to /meeting-notes ─────────────────────────────

  function handleCapture() {
    const notes = input.trim();
    if (!notes) { setError("Please type or paste your meeting notes first."); return; }
    setError("");
    sessionStorage.setItem("pendingNotes", notes);
    router.push("/meeting-notes");
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-6 pt-14 pb-12">

        {/* Headline */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 leading-snug">
            After your meetings —<br />does anything actually happen?
          </h1>
          <p className="text-sm text-gray-400 mt-2">
            {greeting} · {new Date().toLocaleDateString("en-IN", {
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
              "What was decided in the meeting?\n\n• \"Ravi to finalize pricing deck by 25 Mar\"\n• \"Priya owns hiring plan — due end of month\"\n• Paste full meeting notes — AI will extract all tasks with owners & dates"
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
              pressureData.dueSoonItems.length === 0 &&
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
                      {item.daysOverdue >= 3 ? "🔴" : "🟠"}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {item.title}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {item.owner} · {item.daysOverdue > 0 ? `${item.daysOverdue}d overdue` : "due today"}
                      </p>
                    </div>
                  </div>
                  <ArrowRight size={14} className="text-gray-300 group-hover:text-red-400 flex-shrink-0 ml-3 transition-colors" />
                </a>
              ))}

              {pressureData.dueSoonItems.map((item) => (
                <a
                  key={item.id}
                  href={`/tasks/${item.id}`}
                  className="flex items-center justify-between bg-white rounded-xl border border-amber-100 px-4 py-3.5 hover:bg-amber-50 transition-all group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-base flex-shrink-0">🟡</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {item.title}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {item.owner} · due in {Math.abs(item.daysOverdue)} day{Math.abs(item.daysOverdue) !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <ArrowRight size={14} className="text-gray-300 group-hover:text-amber-400 flex-shrink-0 ml-3 transition-colors" />
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
