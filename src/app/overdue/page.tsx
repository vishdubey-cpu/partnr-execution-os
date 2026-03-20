"use client";

import { useEffect, useState, useCallback } from "react";
import { Task } from "@/types";
import { formatDate, getDaysOverdue, FUNCTIONS } from "@/lib/utils";
import { StatusBadge } from "@/components/tasks/StatusBadge";
import { PriorityBadge } from "@/components/tasks/PriorityBadge";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

type OverdueTask = Task & { daysOverdue: number };

const FILTER_OPTIONS = [
  { label: "All Overdue", value: 0 },
  { label: "1+ Days", value: 1 },
  { label: "3+ Days", value: 3 },
  { label: "7+ Days", value: 7 },
];

export default function OverduePage() {
  const [tasks, setTasks] = useState<OverdueTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [minDays, setMinDays] = useState(0);
  const [fnFilter, setFnFilter] = useState("");

  const fetchOverdue = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (minDays > 0) params.set("minDays", String(minDays));
    if (fnFilter) params.set("function", fnFilter);

    try {
      const res = await fetch(`/api/overdue?${params.toString()}`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setTasks(data);
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [minDays, fnFilter]);

  useEffect(() => {
    fetchOverdue();
  }, [fetchOverdue]);

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle size={18} className="text-red-500" />
          <h1 className="text-xl font-semibold text-gray-900">Overdue Tasks</h1>
        </div>
        <p className="text-sm text-gray-500">
          {loading ? "Loading..." : `${tasks.length} overdue tasks`}
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Days filter pills */}
          <div className="flex gap-2">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setMinDays(opt.value)}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  minDays === opt.value
                    ? "bg-red-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="h-4 border-l border-gray-200" />

          {/* Function filter */}
          <select
            value={fnFilter}
            onChange={(e) => setFnFilter(e.target.value)}
            className="border border-gray-200 rounded px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-400"
          >
            <option value="">All Functions</option>
            {FUNCTIONS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        {loading ? (
          <div className="py-16 text-center text-gray-400 text-sm">
            Loading overdue tasks...
          </div>
        ) : tasks.length === 0 ? (
          <div className="py-16 text-center px-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <span className="text-3xl">🏆</span>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              {minDays === 0 && !fnFilter ? "Zero overdue tasks — outstanding!" : "No overdue tasks match these filters"}
            </h3>
            <p className="text-sm text-gray-500 max-w-xs mx-auto leading-relaxed">
              {minDays === 0 && !fnFilter
                ? "Your team is delivering on time. This is what great execution looks like."
                : "Try adjusting the filters above to see a broader view."}
            </p>
            {minDays === 0 && !fnFilter && (
              <a
                href="/dashboard"
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                ← Back to dashboard
              </a>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Task
                  </th>
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Owner
                  </th>
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Function
                  </th>
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Priority
                  </th>
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Due Date
                  </th>
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-red-500 uppercase tracking-wide">
                    Overdue By
                  </th>
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Escalation
                  </th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr
                    key={task.id}
                    className="border-b border-gray-50 hover:bg-red-50/30 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <Link
                        href={`/tasks/${task.id}`}
                        className="font-medium text-gray-800 hover:text-indigo-600 transition-colors line-clamp-1"
                      >
                        {task.title}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-gray-700">{task.owner}</td>
                    <td className="py-3 px-4 text-gray-500 text-xs">
                      {task.function}
                    </td>
                    <td className="py-3 px-4">
                      <PriorityBadge priority={task.priority} size="sm" />
                    </td>
                    <td className="py-3 px-4 text-gray-600 text-xs whitespace-nowrap">
                      {formatDate(task.dueDate)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-red-600 font-semibold text-sm">
                        {task.daysOverdue}d
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={task.status} size="sm" />
                    </td>
                    <td className="py-3 px-4">
                      {task.escalationLevel > 0 ? (
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            task.escalationLevel === 2
                              ? "bg-red-100 text-red-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          L{task.escalationLevel}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
