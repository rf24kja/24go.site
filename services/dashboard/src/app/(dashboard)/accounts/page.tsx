"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  getAccounts, createAccount, startListener, stopListener,
  getListenerStatus, connectTelegram, confirmTelegram, confirmPassword2FA,
  disconnectTelegram, getTelegramStatus,
} from "@/lib/api";
import { Skeleton } from "@/components/Skeleton";

type Account = {
  id: string;
  account_identifier: string;
  platform: string;
  status: "active" | "warming_up" | "cooldown" | "banned" | "paused";
  warmup_stage: number;
  actions_today: number;
  daily_action_limit: number;
};

type TgStatus = { has_session: boolean; connected: boolean; tg_status: string };
type ListenerInfo = { account_id: string; status: string };

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  warming_up: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  cooldown: "bg-orange-500/10 text-orange-400 border border-orange-500/20",
  banned: "bg-rose-500/10 text-rose-400 border border-rose-500/20",
  paused: "bg-slate-500/10 text-slate-400 border border-slate-500/20",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active", warming_up: "Warming Up", cooldown: "Cooldown",
  banned: "Banned", paused: "Paused",
};

const WARMUP_COLORS: Record<number, string> = {
  0: "bg-zinc-600", 1: "bg-amber-500", 2: "bg-amber-400", 3: "bg-emerald-500",
};

export default function AccountsPage() {
  const { auth } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [tgStatuses, setTgStatuses] = useState<Record<string, TgStatus>>({});
  const [listeners, setListeners] = useState<ListenerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addPhone, setAddPhone] = useState("");
  const [addPlatform, setAddPlatform] = useState("telegram");
  const [addSaving, setAddSaving] = useState(false);

  // Connect modal state
  const [connectModal, setConnectModal] = useState<{ accountId: string; phone: string; step: "phone" | "code" | "password" } | null>(null);
  const [connectPhone, setConnectPhone] = useState("");
  const [connectCode, setConnectCode] = useState("");
  const [connectPassword, setConnectPassword] = useState("");
  const [connectBusy, setConnectBusy] = useState(false);
  const [connectError, setConnectError] = useState("");

  const load = () => {
    if (!auth?.token) return;
    setLoading(true);
    Promise.all([
      getAccounts(auth.token),
      getListenerStatus(auth.token).catch(() => ({})),
    ]).then(async ([accts, listeners_]) => {
      const items = accts.items || accts;
      setAccounts(items);
      setListeners((listeners_ as any)?.active_workers ?? []);

      // Fetch TG status for each account
      const statuses: Record<string, TgStatus> = {};
      const results = await Promise.allSettled(
        items.map((acct: any) => getTelegramStatus(auth.token!, acct.id))
      );
      items.forEach((acct: any, i: number) => {
        const r = results[i];
        statuses[acct.id] = r.status === "fulfilled" ? r.value : { has_session: false, connected: false, tg_status: "unknown" };
      });
      setTgStatuses(statuses);
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
      setTimeout(load, 2000);
    } finally { setActionBusy(null); }
  };

  const handleStop = async (accountId: string) => {
    if (!auth?.token) return;
    setActionBusy(accountId);
    try {
      await stopListener(auth.token, accountId);
      setTimeout(load, 2000);
    } finally { setActionBusy(null); }
  };

  // ── Telegram Connect Flow ──────────────────────────────────────────
  const handleConnectStart = (accountId: string) => {
    const acct = accounts.find((a) => a.id === accountId);
    setConnectPhone(acct?.account_identifier || "");
    setConnectModal({ accountId, phone: acct?.account_identifier || "", step: "phone" });
    setConnectError("");
  };

  const handleConnectSendCode = async () => {
    if (!auth?.token || !connectModal) return;
    setConnectBusy(true);
    setConnectError("");
    try {
      await connectTelegram(auth.token, connectModal.accountId, connectPhone);
      setConnectModal({ ...connectModal, step: "code" });
    } catch (e: any) {
      setConnectError(e.message || "Failed to send code");
    } finally {
      setConnectBusy(false);
    }
  };

  const handleConnectConfirm = async () => {
    if (!auth?.token || !connectModal) return;
    setConnectBusy(true);
    setConnectError("");
    try {
      const res = await confirmTelegram(auth.token, connectModal.accountId, connectPhone, connectCode);
      if (res?.status === "password_required") {
        setConnectModal({ ...connectModal, step: "password" });
        setConnectError("");
      } else {
        setConnectModal(null);
        setConnectCode("");
        setConnectPassword("");
        load();
      }
    } catch (e: any) {
      setConnectError(e.message || "Invalid code");
    } finally {
      setConnectBusy(false);
    }
  };

  const handleConnectPassword = async () => {
    if (!auth?.token || !connectModal) return;
    setConnectBusy(true);
    setConnectError("");
    try {
      await confirmPassword2FA(auth.token, connectModal.accountId, connectPassword);
      setConnectModal(null);
      setConnectCode("");
      setConnectPassword("");
      load();
    } catch (e: any) {
      setConnectError(e.message || "Invalid password");
    } finally {
      setConnectBusy(false);
    }
  };

  const handleDisconnect = async (accountId: string) => {
    if (!auth?.token || !confirm("Disconnect this Telegram account?")) return;
    setActionBusy(accountId);
    try {
      await disconnectTelegram(auth.token, accountId);
      load();
    } catch (e: any) { setConnectError(e?.message || "Disconnect failed"); } finally { setActionBusy(null); }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.token) return;
    setAddSaving(true);
    try {
      await createAccount(auth.token, {
        account_identifier: addPhone,
        platform: addPlatform,
      });
      setShowAdd(false);
      setAddPhone("");
      load();
    } catch (e: any) { setConnectError(e?.message || "Add account failed"); } finally { setAddSaving(false); }
  };

  const stats = {
    total: accounts.length,
    connected: Object.values(tgStatuses).filter((s) => s.connected).length,
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

      {/* How it works */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h2 className="text-sm font-medium text-zinc-300 mb-3">How Telegram accounts work</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs text-zinc-400">
          <div className="flex items-start gap-2">
            <span className="text-emerald-400 font-bold text-sm">1</span>
            <div><strong className="text-zinc-300">Add account</strong> — enter your Telegram phone number</div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-emerald-400 font-bold text-sm">2</span>
            <div><strong className="text-zinc-300">Connect</strong> — Telegram sends a code to your app, enter it here</div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-emerald-400 font-bold text-sm">3</span>
            <div><strong className="text-zinc-300">Warm up</strong> — the system gradually builds your account&apos;s reputation (2-5 days)</div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-emerald-400 font-bold text-sm">4</span>
            <div><strong className="text-zinc-300">Listen</strong> — start intercepting DMs as leads automatically</div>
          </div>
        </div>
      </div>

      {/* Add Account Form */}
      {showAdd && (
        <form onSubmit={handleAdd} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-medium text-zinc-400">Add New Account</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Platform</label>
              <select value={addPlatform} onChange={(e) => setAddPlatform(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100">
                <option value="telegram">Telegram</option>
                <option value="vkontakte">VKontakte</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Phone Number</label>
              <input type="tel" placeholder="+66123456789" required value={addPhone} onChange={(e) => setAddPhone(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100" />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={addSaving || !addPhone}
              className="px-4 py-2 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-medium disabled:opacity-50">
              {addSaving ? "Adding..." : "Add Account"}
            </button>
            <button type="button" onClick={() => setShowAdd(false)}
              className="px-4 py-2 bg-zinc-800 text-zinc-400 rounded-lg text-sm">Cancel</button>
          </div>
        </form>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total", value: stats.total, color: "text-zinc-100" },
          { label: "Connected (TG)", value: stats.connected, color: "text-emerald-400" },
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
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">TG Status</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Identifier</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Platform</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Account Status</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Warmup</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Quota</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8">
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              </td></tr>
            ) : accounts.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                <p className="mb-2 text-zinc-300 font-medium">No accounts connected yet</p>
                <p className="text-xs text-zinc-500 mb-3">Click <strong>&quot;+ Add Account&quot;</strong> above to add your first Telegram account.</p>
                <p className="text-xs text-zinc-600">You&apos;ll need access to the Telegram app on your phone to receive the verification code.</p>
              </td></tr>
            ) : (
              accounts.map((acct) => {
                const pct = acct.daily_action_limit > 0
                  ? Math.round((acct.actions_today / acct.daily_action_limit) * 100) : 0;
                const warmupPct = Math.round((acct.warmup_stage / 3) * 100);
                const tg = tgStatuses[acct.id];
                const tgConnected = tg?.connected ?? false;
                const tgHasSession = tg?.has_session ?? false;
                const listenerActive = isListenerActive(acct.id);

                return (
                  <tr key={acct.id} className="border-b border-zinc-800 last:border-0 hover:bg-zinc-800/30">
                    {/* TG Status */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${tgConnected ? "bg-emerald-400 animate-pulse" : tgHasSession ? "bg-amber-400" : "bg-zinc-600"}`} />
                        <span className="text-xs text-zinc-400">
                          {tgConnected ? "Online" : tgHasSession ? "Session" : "No session"}
                        </span>
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
                        <div className="w-20 h-2 bg-zinc-800 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${WARMUP_COLORS[acct.warmup_stage] ?? "bg-zinc-600"}`}
                            style={{ width: `${warmupPct}%` }} />
                        </div>
                        <span className="text-zinc-400 text-xs">{acct.warmup_stage}/3</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${pct > 80 ? "bg-rose-500" : pct > 50 ? "bg-amber-500" : "bg-zinc-500"}`}
                            style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                        <span className="text-zinc-400 text-xs">{acct.actions_today}/{acct.daily_action_limit}</span>
                      </div>
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {!tgHasSession ? (
                          <button onClick={() => handleConnectStart(acct.id)}
                            className="px-2.5 py-1 text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded hover:bg-emerald-500/20 transition">
                            Connect TG
                          </button>
                        ) : (
                          <>
                            <button onClick={() => listenerActive ? handleStop(acct.id) : handleStart(acct.id)}
                              disabled={actionBusy === acct.id || acct.status === "banned"}
                              className={`px-2.5 py-1 text-xs rounded transition border ${
                                listenerActive
                                  ? "bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20"
                                  : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700"
                              } disabled:opacity-40`}>
                              {actionBusy === acct.id ? "..." : listenerActive ? "Stop" : "Listen"}
                            </button>
                            <button onClick={() => handleDisconnect(acct.id)}
                              disabled={actionBusy === acct.id || listenerActive}
                              className="px-2.5 py-1 text-xs text-zinc-500 hover:text-rose-400 border border-zinc-700 rounded hover:border-rose-500/30 transition disabled:opacity-40"
                              title="Disconnect Telegram account (stops listener first)">
                              Disconnect
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Connect Telegram Modal ────────────────────────────────────── */}
      {connectModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setConnectModal(null)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
            {connectModal.step === "phone" ? (
              <>
                <h2 className="text-lg font-bold text-zinc-100">Connect Telegram</h2>
                <p className="text-xs text-zinc-500">Enter the phone number for this account. Telegram will send a verification code.</p>
                <input type="tel" placeholder="+66123456789" value={connectPhone}
                  onChange={(e) => setConnectPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100" />
                {connectError && <p className="text-xs text-rose-400">{connectError}</p>}
                <div className="flex gap-3">
                  <button onClick={handleConnectSendCode} disabled={connectBusy || !connectPhone}
                    className="flex-1 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                    {connectBusy ? "Sending..." : "Send Code"}
                  </button>
                  <button onClick={() => setConnectModal(null)}
                    className="flex-1 py-2 bg-zinc-800 text-zinc-400 rounded-lg text-sm">Cancel</button>
                </div>
              </>
            ) : connectModal.step === "code" ? (
              <>
                <h2 className="text-lg font-bold text-zinc-100">Enter Code</h2>
                <p className="text-xs text-zinc-500">Check Telegram for the verification code sent to <strong className="text-zinc-300">{connectPhone}</strong></p>
                <input type="text" placeholder="12345" value={connectCode}
                  onChange={(e) => setConnectCode(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 font-mono text-center text-lg tracking-widest" />
                {connectError && <p className="text-xs text-rose-400">{connectError}</p>}
                <p className="text-[10px] text-zinc-600">Code expires in ~2 minutes. Check Telegram for the code.</p>
                <div className="flex gap-3">
                  <button onClick={handleConnectConfirm} disabled={connectBusy || !connectCode}
                    className="flex-1 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                    {connectBusy ? "Connecting..." : "Confirm"}
                  </button>
                  <button onClick={handleConnectSendCode} disabled={connectBusy}
                    className="py-2 px-3 bg-zinc-800 text-zinc-400 border border-zinc-700 rounded-lg text-xs hover:bg-zinc-700 transition disabled:opacity-50 whitespace-nowrap">
                    {connectBusy ? "..." : "Resend Code"}
                  </button>
                  <button onClick={() => setConnectModal(null)}
                    className="py-2 px-3 bg-zinc-800 text-zinc-400 rounded-lg text-xs">Cancel</button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-lg font-bold text-zinc-100">Two-Factor Password</h2>
                <p className="text-xs text-zinc-500">This Telegram account has 2FA enabled. Enter your <strong className="text-zinc-300">cloud password</strong> to complete login.</p>
                <input type="password" placeholder="Your 2FA password" value={connectPassword}
                  onChange={(e) => setConnectPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleConnectPassword()}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100" />
                {connectError && <p className="text-xs text-rose-400">{connectError}</p>}
                <p className="text-[10px] text-zinc-600">This is the password you set in Telegram → Settings → Privacy → Two-Step Verification. Not the SMS code.</p>
                <div className="flex gap-3">
                  <button onClick={handleConnectPassword} disabled={connectBusy || !connectPassword}
                    className="flex-1 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                    {connectBusy ? "Authorizing..." : "Confirm Password"}
                  </button>
                  <button onClick={() => setConnectModal(null)}
                    className="flex-1 py-2 bg-zinc-800 text-zinc-400 rounded-lg text-sm">Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
