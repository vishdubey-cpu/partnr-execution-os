"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Task, TaskFilters } from "@/types";
import { TaskTable } from "@/components/tasks/TaskTable";
import { FUNCTIONS } from "@/lib/utils";
import { PlusCircle, Search, SlidersHorizontal, Trash2 } from "lucide-react";

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<TaskFilters>({});
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.status) params.set("status", filters.status);
    if (filters.priority) params.set("priority", filters.priority);
    if (filters.function) params.set("function", filters.function);
    if (search) params.set("search", search);

    try {
      const res = await fetch(`/api/tasks?${params.toString()}`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setTasks(data);
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [filters, search]);

  useEffect(() => {
    const timer = setTimeout(fetchTasks, 300);
    return () => clearTimeout(timer);
  }, [fetchTasks]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = (allIds: string[]) => {
    setSelectedIds((prev) => {
      const allSelected = allIds.every((id) => prev.has(id));
      if (allSelected) return new Set();
      return new Set(allIds);
    });
  };

  const deleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} task(s)? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await fetch("/api/tasks/bulk-delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      setSelectedIds(new Set());
      fetchTasks();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">All Tasks</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? "Loading..." : `${tasks.length} tasks`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <button
              onClick={deleteSelected}
              disabled={deleting}
              className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              <Trash2 size={15} />
              {deleting ? "Deleting..." : `Delete ${selectedIds.size}`}
            </button>
          )}
          <Link
            href="/tasks/new"
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <PlusCircle size={15} />
            New Task
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-gray-400">
            <SlidersHorizontal size={14} />
            <span className="text-xs font-medium text-gray-500">Filters:</span>
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-0 sm:min-w-48">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks or owners..."
              className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          {/* Status */}
          <select
            value={filters.status || ""}
            onChange={(e) =>
              setFilters((f) => ({ ...f, status: e.target.value || undefined }))
            }
            className="border border-gray-200 rounded px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="DONE">Done</option>
            <option value="DELAYED">Delayed</option>
            <option value="OVERDUE">Overdue</option>
          </select>

          {/* Priority */}
          <select
            value={filters.priority || ""}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                priority: e.target.value || undefined,
              }))
            }
            className="border border-gray-200 rounded px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Priorities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          {/* Function */}
          <select
            value={filters.function || ""}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                function: e.target.value || undefined,
              }))
            }
            className="border border-gray-200 rounded px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Functions</option>
            {FUNCTIONS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>

          {/* Clear */}
          {(filters.status || filters.priority || filters.function || search) && (
            <button
              onClick={() => {
                setFilters({});
                setSearch("");
              }}
              className="text-xs text-red-500 hover:text-red-700"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        {loading ? (
          <div className="py-16 text-center text-gray-400 text-sm">
            Loading tasks...
          </div>
        ) : (
          <TaskTable
            tasks={tasks}
            selectedIds={selectedIds}
            onToggle={toggleSelect}
            onToggleAll={toggleAll}
          />
        )}
      </div>
    </div>
  );
}
