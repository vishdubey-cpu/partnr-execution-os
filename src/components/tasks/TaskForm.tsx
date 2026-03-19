"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FUNCTIONS, SOURCES } from "@/lib/utils";

interface TaskFormValues {
  title: string;
  description: string;
  owner: string;
  ownerPhone: string;
  ownerEmail: string;
  function: string;
  priority: string;
  dueDate: string;
  source: string;
}

const defaultValues: TaskFormValues = {
  title: "",
  description: "",
  owner: "",
  ownerPhone: "",
  ownerEmail: "",
  function: "",
  priority: "MEDIUM",
  dueDate: "",
  source: "",
};

export function TaskForm({ initialTitle = "" }: { initialTitle?: string }) {
  const router = useRouter();
  const [form, setForm] = useState<TaskFormValues>({
    ...defaultValues,
    title: initialTitle,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ownerHint, setOwnerHint] = useState("");

  async function handleOwnerBlur() {
    if (!form.owner.trim()) return;
    if (form.ownerPhone || form.ownerEmail) return; // already filled
    try {
      const res = await fetch(`/api/owners?name=${encodeURIComponent(form.owner.trim())}`);
      const data = await res.json();
      if (data) {
        setForm((prev) => ({
          ...prev,
          ownerPhone: prev.ownerPhone || data.ownerPhone || "",
          ownerEmail: prev.ownerEmail || data.ownerEmail || "",
        }));
        setOwnerHint("Contact details auto-filled from previous task");
        setTimeout(() => setOwnerHint(""), 3000);
      }
    } catch {
      // silently ignore
    }
  }

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!form.title || !form.owner || !form.function || !form.dueDate || (!form.ownerPhone && !form.ownerEmail)) {
      setError("Please fill in all required fields. At least one of WhatsApp or Email is required.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create task");
      }

      const task = await res.json();
      router.push(`/tasks/${task.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Task Title <span className="text-red-500">*</span>
        </label>
        <input
          name="title"
          value={form.title}
          onChange={handleChange}
          placeholder="e.g. Finalize Q2 hiring plan"
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          name="description"
          value={form.description}
          onChange={handleChange}
          rows={3}
          placeholder="Additional context or details..."
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
        />
      </div>

      {/* Owner */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Owner Name <span className="text-red-500">*</span>
        </label>
        <input
          name="owner"
          value={form.owner}
          onChange={handleChange}
          onBlur={handleOwnerBlur}
          placeholder="e.g. Priya Sharma"
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
        {ownerHint && <p className="text-xs text-green-600 mt-1">{ownerHint}</p>}
      </div>

      {/* Phone + Email */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            WhatsApp Number
            <span className="text-gray-400 font-normal text-xs ml-1">(for reminders)</span>
          </label>
          <input
            name="ownerPhone"
            value={form.ownerPhone}
            onChange={handleChange}
            placeholder="+919876543210"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email
            <span className="text-gray-400 font-normal text-xs ml-1">(backup)</span>
          </label>
          <input
            name="ownerEmail"
            type="email"
            value={form.ownerEmail}
            onChange={handleChange}
            placeholder="priya@company.com"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>
      <p className="text-xs text-gray-400 -mt-3">At least one contact method required</p>

      {/* Function + Priority */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Function <span className="text-red-500">*</span>
          </label>
          <select
            name="function"
            value={form.function}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
          >
            <option value="">Select function...</option>
            {FUNCTIONS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Priority
          </label>
          <select
            name="priority"
            value={form.priority}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </div>
      </div>

      {/* Due Date + Source */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Due Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            name="dueDate"
            value={form.dueDate}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Source
          </label>
          <select
            name="source"
            value={form.source}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
          >
            <option value="">Select source...</option>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Submit */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="bg-indigo-600 text-white px-5 py-2 rounded text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Creating..." : "Create Task"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
