"use client";

import { useState } from "react";
import { MessageCircle, Copy, Check } from "lucide-react";

interface WeeklySummaryCardProps {
  summaryText: string;
}

export function WeeklySummaryCard({ summaryText }: WeeklySummaryCardProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle size={14} className="text-green-600" />
          <h2 className="text-sm font-semibold text-gray-800">
            WhatsApp Summary
          </h2>
          <span className="text-xs text-gray-400">— ready to copy and send</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded px-2.5 py-1 transition-colors hover:bg-gray-50"
        >
          {copied ? (
            <>
              <Check size={12} className="text-green-600" />
              <span className="text-green-600">Copied!</span>
            </>
          ) : (
            <>
              <Copy size={12} />
              Copy
            </>
          )}
        </button>
      </div>
      <div className="p-5">
        <pre className="text-sm text-gray-700 font-sans whitespace-pre-wrap leading-relaxed bg-gray-50 rounded p-4 border border-gray-100">
          {summaryText}
        </pre>
      </div>
    </div>
  );
}
