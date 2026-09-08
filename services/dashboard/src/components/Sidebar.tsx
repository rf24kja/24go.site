"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useWebSocket } from "@/lib/useWebSocket";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/components/Toast";
import { usePlanAccess } from "@/hooks/usePlanAccess";
import {
  ChartBar, Crosshair, Scales, Radar, Radio, UserCircle,
  Megaphone, CreditCard, UsersGroup, FileText, Heartbeat,
  Cog, LogOut, Cross, Menu, Pen, Send, Bot,
} from "@/components/Icons";

export function Sidebar() {
  const pathname = usePathname();
  const { auth, logout } = useAuth();
  const { connected } = useWebSocket(auth?.user?.tenant_id ?? null, auth?.token ?? null);
  const { t, lang, setLang } = useI18n();
  const { toast } = useToast();
  const { hasAccess } = usePlanAccess();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  if (!auth.token) return null;

  const NAV = [
    { href: "/analytics", label: t("sidebar.analytics"), icon: ChartBar, feature: "analytics" },
    { href: "/leads", label: t("sidebar.leads"), icon: Crosshair, feature: "leads" },
    { href: "/lead-rules", label: t("sidebar.leadRules"), icon: Scales, feature: "lead-rules" },
    { href: "/targets", label: t("sidebar.groupSearch"), icon: Radar, feature: "targets" },
    { href: "/groups", label: t("sidebar.monitoring"), icon: Radio, feature: "groups" },
    { href: "/accounts", label: t("sidebar.accounts"), icon: UserCircle, feature: "accounts" },
    { href: "/proxies", label: t("sidebar.proxies"), icon: Cog, feature: "accounts" },
    { href: "/campaigns", label: t("sidebar.campaigns"), icon: Megaphone, feature: "campaigns" },
    { href: "/mailings", label: t("sidebar.mailings"), icon: Send, feature: "mailings" },
    { href: "/blog-admin", label: t("sidebar.blog"), icon: Pen, feature: "blog-admin" },
    { href: "/billing", label: t("sidebar.billing"), icon: CreditCard },
    { href: "/users", label: t("sidebar.team"), icon: UsersGroup, feature: "users" },
    { href: "/audit", label: t("sidebar.auditLog"), icon: FileText, feature: "audit", ownerOnly: true },
    { href: "/health", label: t("sidebar.health"), icon: Heartbeat, feature: "health" },
    { href: "/help", label: t("sidebar.help"), icon: FileText },
    { href: "/settings", label: t("sidebar.settings"), icon: Cog },
  ].filter((item) => {
    if ((item as any).ownerOnly && auth?.user?.email !== "rf24krsk@gmail.com" && auth?.user?.role !== "owner") return false;
    return !item.feature || hasAccess(item.feature);
  });

  return (
    <>
      <button onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-4 left-4 z-50 md:hidden bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-300 hover:text-zinc-100 transition">
        {mobileOpen ? <Cross className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {mobileOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setMobileOpen(false)} />}

      <aside className={`fixed top-0 bottom-0 z-40 bg-zinc-950 border-r border-zinc-800 flex flex-col transition-all duration-200
        ${mobileOpen ? "left-0 w-60" : "-left-60 md:left-0"} w-60`}>
        <div className="p-5 border-b border-zinc-800">
          <h1 className="text-lg font-bold text-zinc-100">24<span className="text-emerald-400">GO</span></h1>
          <div className="flex items-center gap-2 mt-1">
            <div className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"}`} />
            <p className="text-xs text-zinc-500">{connected ? t("sidebar.live") : t("sidebar.offline")}</p>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                  pathname === item.href || pathname.startsWith(item.href + "/")
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                }`}
              >
                <Icon className="w-[18px] h-[18px] shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-zinc-800 space-y-2">
          {/* Language toggle */}
          <div className="flex items-center gap-1 bg-zinc-900 rounded-lg p-1">
            <button
              onClick={() => setLang("en")}
              className={`flex-1 text-xs py-2 rounded transition min-h-[36px] ${lang === "en" ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              EN
            </button>
            <button
              onClick={() => setLang("ru")}
              className={`flex-1 text-xs py-2 rounded transition min-h-[36px] ${lang === "ru" ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              RU
            </button>
          </div>
          {/* Platform toggle */}
          <div className="flex items-center gap-1 bg-zinc-900 rounded-lg p-1">
            <button
              className="flex-1 text-xs py-2 rounded bg-emerald-500/20 text-emerald-400 min-h-[36px]"
            >
              Telegram
            </button>
            <button
              onClick={() => toast(t("sidebar.comingSoon"), "info")}
              className="flex-1 text-xs py-2 rounded text-zinc-500 hover:text-zinc-300 opacity-50 cursor-not-allowed min-h-[36px]"
              title={t("sidebar.comingSoon")}
            >
              VKontakte
            </button>
          </div>
          <div className="flex flex-col items-center gap-1 pt-1">
            <p className="text-xs text-zinc-500 truncate">{auth.user?.email}</p>
            <button onClick={logout} className="text-xs text-zinc-400 hover:text-rose-400 transition flex items-center gap-1.5 min-h-[36px] py-1">
              <LogOut className="w-4 h-4" /> {t("sidebar.signOut")}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
