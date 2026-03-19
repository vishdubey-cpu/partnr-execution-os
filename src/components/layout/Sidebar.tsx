"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  CheckSquare,
  AlertTriangle,
  BarChart2,
  PlusCircle,
  Zap,
  NotebookText,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Home", href: "/", icon: Zap },
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "All Tasks", href: "/tasks", icon: CheckSquare },
  { label: "New Task", href: "/tasks/new", icon: PlusCircle },
  { label: "Overdue", href: "/overdue", icon: AlertTriangle },
  { label: "Weekly Review", href: "/weekly-review", icon: BarChart2 },
  { label: "Meeting Notes", href: "/meeting-notes", icon: NotebookText },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="w-56 flex-shrink-0 bg-gray-900 flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-indigo-500 rounded flex items-center justify-center">
            <Zap size={14} className="text-white" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-none">Partnr</p>
            <p className="text-gray-400 text-xs mt-0.5">Execution OS</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors",
                isActive
                  ? "bg-indigo-600 text-white"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white"
              )}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-gray-700 space-y-2">
        <p className="text-gray-500 text-xs px-1">Internal Tool v1.0</p>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 rounded text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <LogOut size={14} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
