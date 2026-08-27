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
  const [showAdd, setShowAdd] = useState(false);
  const [addPhone, setAddPhone] = useState("");
  const [addUsername, setAddUsername] = useState("");
  const [addPlatform, setAddPlatform] = useState("telegram");
  const [addSaving, setAddSaving] = useState(false);

  const load = () => {
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
  };

  useEffect(() => { load(); }, [auth?.token]);

  const isListenerActive = (accountId: string) =>
    listeners.some((l) => l.account_id === accountId && l.status === "active");

  const handleStart = async (accountId: string) => {
    if (!auth?.token) return;
    setActionBusy(accountId);
    try {
      await startListener(auth.token, accountId);
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

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.token) return;
    setAddSaving(true);
    try {
      // Use the accounts endpoint directly — create via raw POST
      const res = await fetch(`${window.location.origin.includes("localhost") ? "http://localhost:8000" : ""}/api/v1/accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify({
          account_identifier: addPhone || addUsername,
          platform: addPlatform,
          daily_action_limit: 20,
        }),
      });
      if (res.ok) {
        setShowAdd(false);
        setAddPhone("");
        setAddUsername("");
        load();
      }
    } finally {
      setAddSaving(false);
    }
  };

  const stats = {
    total: accounts.length,
    active: accounts.filter((a) => a.status === "active").length,
    warming: accounts.filter((a) => a.status === "warming_up").length,
    banned: accounts.filter((a) => a.status === "banned").length,
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-100">Accounts</h1>
        <button onClick={() => setShowAdd(!showAdd)}
          className="px-4 py-2 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-200">
          + Add Account
        </button>
      </div>

      {/* Add Account Form */}
      {showAdd && (
        <form onSubmit={handleAdd} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-medium text-zinc-400">Add New Account</h2>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Platform</label>
              <select value={addPlatform} onChange={(e) => setAddPlatform(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-zinc-500">
                <option value="telegram">Telegram</option>
                <option value="vkontakte">VKontakte</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Phone Number</label>
              <input type="tel" placeholder="+66123456789" value={addPhone} onChange={(e) => setAddPhone(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-zinc-500" />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Username (optional)</label>
              <input type="text" placeholder="agent_name" value={addUsername} onChange={(e) => setAddUsername(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-zinc-500" />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={addSaving || (!addPhone && !addUsername)}
              className="px-4 py-2 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-200 disabled:opacity-50">
              {addSaving ? "Adding..." : "Add Account"}
            </button>
            <button type="button" onClick={() => setShowAdd(false)}
              className="px-4 py-2 bg-zinc-800 text-zinc-400 rounded-lg text-sm">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-500">Loading...</td></tr>
            ) : accounts.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                <p className="mb-2">No accounts yet. Add a Telegram or VK account to start.</p>
                <p className="text-xs text-zinc-600">Accounts are warmed up automatically before posting.</p>
              </td></tr>
            ) : (
              accounts.map((acct) => {
                const pct = acct.daily_action_limit > 0
                  ? Math.round((acct.actions_today / acct.daily_action_limit) * 100)
                  : 0;
                const warmupPct = acct.warmup_progress ?? Math.round((acct.warmup_stage / 3) * 100);
                const listenerActive = isListenerActive(acct.id);
                return (
                  <tr key={acct.id} className="border-b border-zinc-800 last:border-0 hover:bg-zinc-800/30">
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
                    <td className="px-4 py-3 text-zinc-400 capitalize">{acct.platform}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[acct.status] ?? ""}`}>
                        {STATUS_LABELS[acct.status] ?? acct.status}
                      </span>
                    </td>
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
