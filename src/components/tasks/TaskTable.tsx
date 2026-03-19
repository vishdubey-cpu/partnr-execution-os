"use client";

import Link from "next/link";
import { Task } from "@/types";
import { formatDate, getDaysOverdue } from "@/lib/utils";
import { StatusBadge } from "./StatusBadge";
import { PriorityBadge } from "./PriorityBadge";
import { AlertCircle } from "lucide-react";

interface TaskTableProps {
  tasks: Task[];
  showDaysOverdue?: boolean;
  selectedIds?: Set<string>;
  onToggle?: (id: string) => void;
  onToggleAll?: (allIds: string[]) => void;
}

export function TaskTable({ tasks, showDaysOverdue, selectedIds, onToggle, onToggleAll }: TaskTableProps) {
  const selectable = !!onToggle;
  const allSelected = selectable && tasks.length > 0 && tasks.every((t) => selectedIds?.has(t.id));
  if (tasks.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p className="text-sm">No tasks found</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            {selectable && (
              <th className="py-2.5 pl-4 pr-2 w-8">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => onToggleAll!(tasks.map((t) => t.id))}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
              </th>
            )}
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
            {showDaysOverdue && (
              <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Overdue By
              </th>
            )}
            <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Status
            </th>
            <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Escalation
            </th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const daysOverdue = getDaysOverdue(task.dueDate);
            return (
              <tr
                key={task.id}
                className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${selectedIds?.has(task.id) ? "bg-indigo-50" : ""}`}
              >
                {selectable && (
                  <td className="py-3 pl-4 pr-2">
                    <input
                      type="checkbox"
                      checked={selectedIds?.has(task.id) ?? false}
                      onChange={() => onToggle!(task.id)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </td>
                )}
                <td className="py-3 px-4">
                  <Link
                    href={`/tasks/${task.id}`}
                    className="font-medium text-gray-800 hover:text-indigo-600 transition-colors line-clamp-1"
                  >
                    {task.title}
                  </Link>
                  {task.source && (
                    <p className="text-xs text-gray-400 mt-0.5">{task.source}</p>
                  )}
                </td>
                <td className="py-3 px-4 text-gray-700">{task.owner}</td>
                <td className="py-3 px-4 text-gray-500 text-xs">{task.function}</td>
                <td className="py-3 px-4">
                  <PriorityBadge priority={task.priority} size="sm" />
                </td>
                <td className="py-3 px-4 text-gray-600 whitespace-nowrap text-xs">
                  {formatDate(task.dueDate)}
                </td>
                {showDaysOverdue && (
                  <td className="py-3 px-4">
                    {daysOverdue > 0 ? (
                      <span className="text-red-600 font-medium text-xs flex items-center gap-1">
                        <AlertCircle size={12} />
                        {daysOverdue}d
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                )}
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
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
