"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowRight } from "lucide-react";

interface PressureItem {
  id: string;
  title: string;
  owner: string;
  dueDate: string;
  daysOverdue: number;
}

interface HomeData {
  overdueItems: PressureItem[];
  dueTodayCount: number;
  totalOpen: number;
}

export default function HomePage() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);

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
            dueDate: t.dueDate,
            daysOverdue: Math.floor(
              (now - new Date(t.dueDate).getTime()) / (1000 * 60 * 60 * 24)
            ),
          }));
        setData({
          overdueItems,
          dueTodayCount: d.dueTodayTasks || 0,
          totalOpen: d.totalOpenTasks || 0,
        });
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  function handleCapture() {
    if (!input.trim()) return;
    const isLong =
      input.trim().split("\n").length > 2 || input.length > 150;
    if (isLong) {
      sessionStorage.setItem("pendingNotes", input.trim());
      router.push("/meeting-notes");
    } else {
      router.push(`/tasks/new?title=${encodeURIComponent(input.trim())}`);
    }
  }

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const isLong =
    input.trim().split("\n").length > 2 || input.length > 150;

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

        {/* Capture Box — thought catcher */}
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
                : isLong
                ? "Looks like meeting notes → will extract tasks"
                : "Short entry → creates a quick task"}
            </p>
            <button
              onClick={handleCapture}
              disabled={!input.trim()}
              className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Sparkles size={13} />
              {isLong ? "Extract Tasks" : "Capture"}
            </button>
          </div>
        </div>

        {/* Pressure Radar — what's burning */}
        <div className="mb-8">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            needs your attention
          </p>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-[62px] bg-gray-100 rounded-xl animate-pulse"
                />
              ))}
            </div>
          ) : !data ||
            (data.overdueItems.length === 0 && data.dueTodayCount === 0) ? (
            <div className="bg-white rounded-xl border border-gray-100 px-5 py-8 text-center">
              <p className="text-sm text-gray-400">Nothing urgent right now</p>
              <p className="text-xs text-gray-300 mt-1">
                You&apos;re on top of things ✓
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.overdueItems.map((item) => (
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

              {data.dueTodayCount > 0 && (
                <a
                  href="/tasks"
                  className="flex items-center justify-between bg-white rounded-xl border border-amber-100 px-4 py-3.5 hover:bg-amber-50 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-base">🟡</span>
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">
                        {data.dueTodayCount} task
                        {data.dueTodayCount > 1 ? "s" : ""}
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
            Extract from meeting notes
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
