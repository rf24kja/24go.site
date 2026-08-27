"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getAccounts, startListener, stopListener, getListenerStatus } from "@/lib/api";

type Account = {
  id: string;
  account_identifier: string;
  platform: string;
  status: "active" | "warming_up" | "cooldown" | "banned" | "paused";
  warmup_stage: number;
  actions_today: number;
  daily_action_limit: number;
  warmup_progress?: number;
};

type ListenerInfo = { account_id: string; status: string; pid?: number };

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  warming_up: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  cooldown: "bg-orange-500/10 text-orange-400 border border-orange-500/20",
  banned: "bg-rose-500/10 text-rose-400 border border-rose-500/20",
  paused: "bg-slate-500/10 text-slate-400 border border-slate-500/20",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  warming_up: "Warming Up",
  cooldown: "Cooldown",
  banned: "Banned",
  paused: "Paused",
};

const WARMUP_COLORS: Record<number, string> = {
  0: "bg-zinc-600",
  1: "bg-amber-500",
  2: "bg-amber-400",
  3: "bg-emerald-500",
};

export default function AccountsPage() {
  const { auth } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [listeners, setListeners] = useState<ListenerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!auth?.token) return;
    setLoading(true);
    Promise.all([
      getAccounts(auth.token),
      getListenerStatus(auth.token).catch(() => ({})),
    ]).then(([accts, listeners_]) => {
      setAccounts(accts);
      const raw = listeners_ as any;
      setListeners(raw?.active_workers ?? []);
    }).finally(() => setLoading(false));
  }, [auth?.token]);

  const isListenerActive = (accountId: string) =>
    listeners.some((l) => l.account_id === accountId && l.status === "active");

  const handleStart = async (accountId: string) => {
    if (!auth?.token) return;
    setActionBusy(accountId);
    try {
      await startListener(auth.token, accountId);
      // Refresh listener status after a short delay
      setTimeout(async () => {
        const s = await getListenerStatus(auth.token!).catch(() => ({}));
        setListeners((s as any)?.active_workers ?? []);
      }, 2000);
    } finally {
      setActionBusy(null);
    }
  };

  const handleStop = async (accountId: string) => {
    if (!auth?.token) return;
    setActionBusy(accountId);
    try {
      await stopListener(auth.token, accountId);
      setTimeout(async () => {
        const s = await getListenerStatus(auth.token!).catch(() => ({}));
        setListeners((s as any)?.active_workers ?? []);
      }, 2000);
    } finally {
      setActionBusy(null);
    }
  };

  // Stats
  const stats = {
    total: accounts.length,
    active: accounts.filter((a) => a.status === "active").length,
    warming: accounts.filter((a) => a.status === "warming_up").length,
    banned: accounts.filter((a) => a.status === "banned").length,
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold text-zinc-100">Accounts</h1>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total", value: stats.total, color: "text-zinc-100" },
          { label: "Active", value: stats.active, color: "text-emerald-400" },
          { label: "Warming Up", value: stats.warming, color: "text-amber-400" },
          { label: "Banned", value: stats.banned, color: "text-rose-400" },
        ].map((s) => (
          <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-zinc-500 text-xs mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Accounts table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Listener</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Identifier</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Platform</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Status</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Warmup</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Daily Quota</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-zinc-500">Loading...</td></tr>
            ) : accounts.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-zinc-500">No accounts found.</td></tr>
            ) : (
              accounts.map((acct) => {
                const pct = acct.daily_action_limit > 0
                  ? Math.round((acct.actions_today / acct.daily_action_limit) * 100)
                  : 0;
                const warmupPct = acct.warmup_progress ?? Math.round((acct.warmup_stage / 3) * 100);
                const listenerActive = isListenerActive(acct.id);
                return (
                  <tr key={acct.id} className="border-b border-zinc-800 last:border-0 hover:bg-zinc-800/30">
                    {/* Listener status dot + controls */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${listenerActive ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"}`} />
                        <button
                          onClick={() => listenerActive ? handleStop(acct.id) : handleStart(acct.id)}
                          disabled={actionBusy === acct.id || acct.status === "banned"}
                          className={`text-xs px-2 py-1 rounded transition ${
                            listenerActive
                              ? "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20"
                              : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 border border-zinc-700"
                          } disabled:opacity-40`}>
                          {actionBusy === acct.id ? "..." : listenerActive ? "Stop" : "Start"}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-100 font-mono text-xs">{acct.account_identifier}</td>
                    <td className="px-4 py-3 text-zinc-400">{acct.platform}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[acct.status] ?? ""}`}>
                        {STATUS_LABELS[acct.status] ?? acct.status}
                      </span>
                    </td>
                    {/* Warmup progress bar */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${WARMUP_COLORS[acct.warmup_stage] ?? "bg-zinc-600"}`}
                            style={{ width: `${warmupPct}%` }}
                          />
                        </div>
                        <span className="text-zinc-400 text-xs">{acct.warmup_stage}/3</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${pct > 80 ? "bg-rose-500" : pct > 50 ? "bg-amber-500" : "bg-zinc-500"}`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <span className="text-zinc-400 text-xs">{acct.actions_today}/{acct.daily_action_limit}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">
                      {pct}%
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
