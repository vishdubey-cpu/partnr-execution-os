import { TaskForm } from "@/components/tasks/TaskForm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NewTaskPage() {
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-5">
        <Link
          href="/tasks"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3"
        >
          <ArrowLeft size={14} />
          Back to Tasks
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">Create New Task</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          All tasks require an owner and due date.
        </p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <TaskForm />
      </div>
    </div>
  );
}
