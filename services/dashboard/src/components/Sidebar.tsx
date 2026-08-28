"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useWebSocket } from "@/lib/useWebSocket";

const NAV = [
  { href: "/analytics", label: "Analytics", icon: "📊" },
  { href: "/leads", label: "Leads", icon: "🎯" },
  { href: "/scoring", label: "Scoring", icon: "⚖️" },
  { href: "/targets", label: "Targets", icon: "🔍" },
  { href: "/accounts", label: "Accounts", icon: "👤" },
  { href: "/campaigns", label: "Campaigns", icon: "📣" },
  { href: "/billing", label: "Billing", icon: "💳" },
  { href: "/users", label: "Team", icon: "👥" },
  { href: "/audit", label: "Audit Log", icon: "📋" },
  { href: "/health", label: "Health", icon: "💓" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { auth, logout } = useAuth();
  const { connected } = useWebSocket(auth?.user?.tenant_id ?? null, auth?.token ?? null);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Auto-close mobile sidebar on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  if (!auth.token) return null;

  return (
    <>
      {/* Mobile hamburger */}
      <button onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-4 left-4 z-50 md:hidden bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-300 hover:text-zinc-100 transition">
        {mobileOpen ? "✕" : "☰"}
      </button>

      {/* Backdrop */}
      {mobileOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setMobileOpen(false)} />}

      <aside className={`fixed top-0 bottom-0 z-40 bg-zinc-950 border-r border-zinc-800 flex flex-col transition-all duration-200
        ${mobileOpen ? "left-0 w-60" : "-left-60 md:left-0"} w-60`}>
        <div className="p-5 border-b border-zinc-800">
          <h1 className="text-lg font-bold text-zinc-100">24<span className="text-emerald-400">GO</span></h1>
          <div className="flex items-center gap-2 mt-1">
            <div className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"}`} />
            <p className="text-xs text-zinc-500">{connected ? "Live" : "Offline"}</p>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                pathname === item.href
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-zinc-800">
          <p className="text-xs text-zinc-500 truncate">{auth.user?.email}</p>
          <button onClick={logout} className="text-xs text-zinc-400 hover:text-rose-400 mt-1.5 transition flex items-center gap-1.5">
            <span>🚪</span> Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
