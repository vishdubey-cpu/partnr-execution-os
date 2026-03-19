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
    <>
      {/* Mobile card list */}
      <div className="md:hidden divide-y divide-gray-100">
        {selectable && (
          <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => onToggleAll!(tasks.map((t) => t.id))}
              className="rounded border-gray-300 text-indigo-600"
            />
            <span className="text-xs text-gray-500 font-medium">Select all</span>
          </div>
        )}
        {tasks.map((task) => {
          const daysOverdue = getDaysOverdue(task.dueDate);
          const isSelected = selectedIds?.has(task.id);
          return (
            <div key={task.id} className={`px-4 py-3.5 flex items-start gap-3 ${isSelected ? "bg-indigo-50" : "bg-white"}`}>
              {selectable && (
                <input
                  type="checkbox"
                  checked={isSelected ?? false}
                  onChange={() => onToggle!(task.id)}
                  className="mt-0.5 rounded border-gray-300 text-indigo-600 flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <Link href={`/tasks/${task.id}`} className="font-medium text-gray-800 hover:text-indigo-600 text-sm line-clamp-2">
                  {task.title}
                </Link>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <StatusBadge status={task.status} size="sm" />
                  <PriorityBadge priority={task.priority} size="sm" />
                  {task.owner && <span className="text-xs text-gray-500">{task.owner}</span>}
                  {task.dueDate && (
                    <span className={`text-xs ${daysOverdue > 0 && task.status !== "DONE" ? "text-red-500 font-medium" : "text-gray-400"}`}>
                      {daysOverdue > 0 && task.status !== "DONE" ? `${daysOverdue}d overdue` : formatDate(task.dueDate)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {selectable && (
                <th className="py-2.5 pl-4 pr-2 w-8">
                  <input type="checkbox" checked={allSelected} onChange={() => onToggleAll!(tasks.map((t) => t.id))} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                </th>
              )}
              <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Task</th>
              <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Owner</th>
              <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Function</th>
              <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Priority</th>
              <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Due Date</th>
              {showDaysOverdue && <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Overdue By</th>}
              <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Escalation</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => {
              const daysOverdue = getDaysOverdue(task.dueDate);
              return (
                <tr key={task.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${selectedIds?.has(task.id) ? "bg-indigo-50" : ""}`}>
                  {selectable && (
                    <td className="py-3 pl-4 pr-2">
                      <input type="checkbox" checked={selectedIds?.has(task.id) ?? false} onChange={() => onToggle!(task.id)} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                    </td>
                  )}
                  <td className="py-3 px-4">
                    <Link href={`/tasks/${task.id}`} className="font-medium text-gray-800 hover:text-indigo-600 transition-colors line-clamp-1">{task.title}</Link>
                    {task.source && <p className="text-xs text-gray-400 mt-0.5">{task.source}</p>}
                  </td>
                  <td className="py-3 px-4 text-gray-700">{task.owner}</td>
                  <td className="py-3 px-4 text-gray-500 text-xs">{task.function}</td>
                  <td className="py-3 px-4"><PriorityBadge priority={task.priority} size="sm" /></td>
                  <td className="py-3 px-4 text-gray-600 whitespace-nowrap text-xs">{formatDate(task.dueDate)}</td>
                  {showDaysOverdue && (
                    <td className="py-3 px-4">
                      {daysOverdue > 0 ? (
                        <span className="text-red-600 font-medium text-xs flex items-center gap-1"><AlertCircle size={12} />{daysOverdue}d</span>
                      ) : <span className="text-gray-400 text-xs">—</span>}
                    </td>
                  )}
                  <td className="py-3 px-4"><StatusBadge status={task.status} size="sm" /></td>
                  <td className="py-3 px-4">
                    {task.escalationLevel > 0 ? (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${task.escalationLevel === 2 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>L{task.escalationLevel}</span>
                    ) : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
