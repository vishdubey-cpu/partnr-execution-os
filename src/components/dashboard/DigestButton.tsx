"use client";

import { useState } from "react";
import { Send } from "lucide-react";

export function DigestButton() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function sendNow() {
    setState("sending");
    try {
      const res = await fetch("/api/jobs/daily-digest");
      if (res.ok) {
        setState("sent");
        setTimeout(() => setState("idle"), 4000);
      } else {
        const data = await res.json();
        console.error("[DigestButton] Error:", data);
        setState("error");
        setTimeout(() => setState("idle"), 4000);
      }
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 4000);
    }
  }

  return (
    <button
      onClick={sendNow}
      disabled={state === "sending" || state === "sent"}
      className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all disabled:cursor-not-allowed ${
        state === "sent"
          ? "bg-green-100 text-green-700"
          : state === "error"
          ? "bg-red-100 text-red-700"
          : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
      }`}
    >
      <Send size={11} />
      {state === "sending" ? "Sending…" : state === "sent" ? "✓ Sent!" : state === "error" ? "Failed — retry" : "Send digest now"}
    </button>
  );
}
