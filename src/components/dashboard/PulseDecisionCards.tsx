"use client";

import { useEffect, useState } from "react";
import type { PulseTask } from "@/types";

const severityConfig: Record<
  PulseTask["severityTag"],
  { label: string; bg: string; text: string; border: string }
> = {
  CRITICAL:       { label: "Critical",       bg: "bg-red-100",    text: "text-red-700",    border: "border-l-red-600" },
  ESCALATED:      { label: "Escalated",      bg: "bg-orange-100", text: "text-orange-700", border: "border-l-orange-500" },
  REPEATED_DELAY: { label: "Repeated Delay", bg: "bg-amber-100",  text: "text-amber-700",  border: "border-l-amber-400" },
  BLOCKED:        { label: "Blocked",        bg: "bg-gray-100",   text: "text-gray-600",   border: "border-l-gray-400" },
};

export function PulseDecisionCards({ tasks }: { tasks: PulseTask[] }) {
  const [snoozed, setSnoozed] = useState<Set<string>>(new Set());

  useEffect(() => {
    const now = Date.now();
    const newSnoozed = new Set<string>();
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith("pulse_snooze_")) continue;
      const expiry = parseInt(localStorage.getItem(key) || "0");
      if (expiry > now) {
        newSnoozed.add(key.replace("pulse_snooze_", ""));
      } else {
        localStorage.removeItem(key);
      }
    }
    setSnoozed(newSnoozed);
  }, []);

  const handleSnooze = (taskId: string) => {
    const expiry = Date.now() + 3 * 24 * 60 * 60 * 1000;
    localStorage.setItem(`pulse_snooze_${taskId}`, String(expiry));
    setSnoozed((prev) => { const next = new Set(prev); next.add(taskId); return next; });
  };

  const visible = tasks.filter((t) => !snoozed.has(t.id));

  if (visible.length === 0) {
    return (
      <p className="text-sm text-gray-400 py-3 italic">
        No items require your decision right now.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {visible.map((t) => {
        const cfg = severityConfig[t.severityTag] ?? severityConfig.CRITICAL;
        return (
          <div
            key={t.id}
            className={`bg-white border border-gray-200 border-l-4 ${cfg.border} rounded-r-xl px-5 py-4`}
          >
            {/* Severity + owner */}
            <div className="flex items-center justify-between mb-2">
              <span className={`inline-flex text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                {cfg.label}
              </span>
              <span className="text-xs text-gray-400">{t.owner}</span>
            </div>

            {/* Task title */}
            <p className="text-sm font-semibold text-gray-900 mb-1.5 leading-snug">{t.title}</p>

            {/* Situation narrative */}
            <p className="text-sm text-gray-600 leading-relaxed mb-1.5">{t.situation}</p>

            {/* Why it matters */}
            {t.whyItMatters && (
              <p className="text-xs text-gray-400 italic mb-3">
                Why this matters: {t.whyItMatters}
              </p>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-1 border-t border-gray-50 mt-2">
              <a
                href={`/tasks/${t.id}`}
                className="text-xs font-semibold bg-indigo-600 text-white px-3 py-1.5 rounded-md hover:bg-indigo-700 transition-colors"
              >
                Review
              </a>
              <a
                href={`/tasks/${t.id}`}
                className="text-xs font-medium bg-gray-100 text-gray-700 px-3 py-1.5 rounded-md hover:bg-gray-200 transition-colors"
              >
                Reassign
              </a>
              <button
                onClick={() => handleSnooze(t.id)}
                className="text-xs text-gray-400 hover:text-gray-600 ml-auto transition-colors"
              >
                Snooze 3 days
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
