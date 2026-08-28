"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { getTargets, getAccounts, getCampaigns, getLeads, getListenerStatus } from "@/lib/api";

type Step = {
  id: string;
  label: string;
  description: string;
  href: string;
  done: boolean;
  icon: string;
};

export function OnboardingChecklist() {
  const { auth } = useAuth();
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!auth?.token) return;
    setLoading(true);

    Promise.all([
      getTargets(auth.token).catch(() => ({ items: [] })),
      getAccounts(auth.token).catch(() => ({ items: [] })),
      getCampaigns(auth.token).catch(() => ({ items: [] })),
      getLeads(auth.token, { limit: 1 }).catch(() => ({ items: [], total: 0 })),
      getListenerStatus(auth.token).catch(() => ({ active_workers: [] })),
    ]).then(([targets, accounts, campaigns, leads, listeners]) => {
      const hasTargets = (targets.items || []).length > 0;
      const accountsList = accounts.items || [];
      const hasAccounts = accountsList.length > 0;
      const hasActiveAccount = accountsList.some((a: any) => a.status === "active");
      const hasListener = ((listeners as any).active_workers || []).length > 0;
      const hasCampaigns = (campaigns.items || []).length > 0;
      const hasLeads = (leads.total || (leads.items || []).length) > 0;

      setSteps([
        {
          id: "targets",
          label: "Discover targets",
          description: "Find Telegram groups and channels in your niche",
          href: "/targets",
          done: hasTargets,
          icon: "🔍",
        },
        {
          id: "account",
          label: "Connect Telegram",
          description: "Link your Telegram account to start intercepting DMs",
          href: "/accounts",
          done: hasAccounts,
          icon: "✈️",
        },
        {
          id: "warmup",
          label: "Warm up account",
          description: "Build reputation before active outreach",
          href: "/accounts",
          done: hasActiveAccount,
          icon: "🔥",
        },
        {
          id: "listener",
          label: "Start listener",
          description: "Begin intercepting incoming messages as leads",
          href: "/accounts",
          done: hasListener,
          icon: "📡",
        },
        {
          id: "campaign",
          label: "Create campaign",
          description: "Set up automated posting to your targets",
          href: "/campaigns",
          done: hasCampaigns,
          icon: "📣",
        },
        {
          id: "leads",
          label: "First lead captured",
          description: "Wait for incoming messages to be classified",
          href: "/leads",
          done: hasLeads,
          icon: "🎯",
        },
      ]);
    }).finally(() => setLoading(false));
  }, [auth?.token]);

  if (loading || steps.length === 0) return null;

  const completed = steps.filter((s) => s.done).length;
  const allDone = completed === steps.length;
  const pct = Math.round((completed / steps.length) * 100);

  // If everything is done, collapse automatically
  if (allDone && collapsed) return null;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl mb-6 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-zinc-800/50 transition"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-zinc-100">
            {allDone ? "🎉 Setup complete!" : `Setup progress — ${completed}/${steps.length} steps`}
          </span>
          {!allDone && (
            <span className="text-xs text-zinc-500">Click each step to get started</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="w-32 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                allDone ? "bg-emerald-500" : "bg-emerald-400"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs text-zinc-400">{pct}%</span>
          <span className="text-zinc-500 text-xs">{collapsed ? "▼" : "▲"}</span>
        </div>
      </button>

      {/* Steps */}
      {!collapsed && (
        <div className="px-5 pb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {steps.map((step, i) => (
            <Link
              key={step.id}
              href={step.href}
              className={`flex items-start gap-3 p-3 rounded-lg border transition ${
                step.done
                  ? "border-emerald-500/20 bg-emerald-500/5"
                  : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-600 hover:bg-zinc-800"
              }`}
            >
              <span className="text-lg mt-0.5">{step.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${step.done ? "text-emerald-400" : "text-zinc-200"}`}>
                    {step.done ? "✓ " : `${i + 1}. `}{step.label}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">{step.description}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
