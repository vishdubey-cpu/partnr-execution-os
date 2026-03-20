"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Menu, X } from "lucide-react";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Public owner-facing pages: no sidebar, no auth nav, no Sign Out
  const isPublic =
    pathname.startsWith("/login") ||
    pathname.startsWith("/task-view") ||
    pathname.startsWith("/my-tasks");

  if (isPublic) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer */}
          <div className="relative z-10 flex">
            <Sidebar onClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-gray-900 border-b border-gray-700 flex-shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-gray-300 hover:text-white p-1"
          >
            <Menu size={20} />
          </button>
          <span className="text-white font-semibold text-sm">Partnr Execution OS</span>
        </div>

        <main className="flex-1 overflow-y-auto bg-gray-50">{children}</main>
      </div>
    </div>
  );
}
