"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import {
  getAccounts, createAccount, startListener, stopListener,
  getListenerStatus, connectTelegram, confirmTelegram, confirmPassword2FA,
  disconnectTelegram, getTelegramStatus,
  bulkCreateAccounts, bulkConnectAccounts,
} from "@/lib/api";
import { Skeleton } from "@/components/Skeleton";
import { Spinner } from "@/components/Spinner";

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

const getStatusLabels = (t: (k: string) => string) => ({
  active: t("accounts.status.active"),
  warming_up: t("accounts.status.warmingUp"),
  cooldown: t("accounts.status.cooldown"),
  banned: t("accounts.status.banned"),
  paused: t("accounts.status.paused"),
});

const WARMUP_COLORS: Record<number, string> = {
  0: "bg-zinc-600", 1: "bg-amber-500", 2: "bg-amber-400", 3: "bg-emerald-500",
};

export default function AccountsPage() {
  const { auth } = useAuth();
  const { t } = useI18n();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [tgStatuses, setTgStatuses] = useState<Record<string, TgStatus>>({});
  const [listeners, setListeners] = useState<ListenerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addPhone, setAddPhone] = useState("");
  const [addPlatform, setAddPlatform] = useState("telegram");
  const [addSaving, setAddSaving] = useState(false);

  // Connect modal state (Telegram)
  const [connectModal, setConnectModal] = useState<{ accountId: string; phone: string; step: "phone" | "code" | "password" } | null>(null);
  const [connectPhone, setConnectPhone] = useState("");
  const [connectCode, setConnectCode] = useState("");
  const [connectPassword, setConnectPassword] = useState("");
  const [connectBusy, setConnectBusy] = useState(false);
  const [connectError, setConnectError] = useState("");

  // VK connect state
  const [vkModal, setVkModal] = useState<string | null>(null); // accountId
  const [vkToken, setVkToken] = useState("");
  const [vkBusy, setVkBusy] = useState(false);
  const [vkError, setVkError] = useState("");

  // Bulk import state
  const [showBulk, setShowBulk] = useState(false);
  const [bulkPlatform, setBulkPlatform] = useState("telegram");
  const [bulkPhones, setBulkPhones] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ created: number; errors: string[]; sent: number; failed: string[] } | null>(null);

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
      setConnectError(e.message || t("accounts.failedToSendCode"));
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
      setConnectError(e.message || t("accounts.invalidCode"));
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
      setConnectError(e.message || t("accounts.invalidPassword"));
    } finally {
      setConnectBusy(false);
    }
  };

  const handleDisconnect = async (accountId: string) => {
    if (!auth?.token || !confirm(t("accounts.disconnectConfirm"))) return;
    setActionBusy(accountId);
    try {
      await disconnectTelegram(auth.token, accountId);
      load();
    } catch (e: any) { setConnectError(e?.message || t("accounts.disconnectFailed")); } finally { setActionBusy(null); }
  };

  // ── VK Connect Flow ──────────────────────────────────────────────
  const handleVkConnect = async () => {
    if (!auth?.token || !vkModal || !vkToken.trim()) return;
    setVkBusy(true);
    setVkError("");
    try {
      const res = await fetch(`/api/v1/accounts/${vkModal}/connect-vk`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify({ token: vkToken.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || t("accounts.vkConnectFailed"));
      }
      setVkModal(null);
      setVkToken("");
      load();
    } catch (e: any) {
      setVkError(e.message || t("accounts.vkConnectFailed"));
    } finally {
      setVkBusy(false);
    }
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
    } catch (e: any) { setConnectError(e?.message || t("accounts.addFailed")); } finally { setAddSaving(false); }
  };

  // ── Bulk Import ──────────────────────────────────────────────────────
  const bulkParsed = bulkPhones
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const handleBulkImport = async () => {
    if (!auth?.token || bulkParsed.length === 0) return;
    setBulkBusy(true);
    setBulkResult(null);
    try {
      const accounts = bulkParsed.map((p) => ({ platform: bulkPlatform, account_identifier: p }));
      const createRes = await bulkCreateAccounts(auth.token, accounts);
      // Auto-connect all created accounts (up to 10)
      let connectRes = { sent: 0, failed: [] as string[] };
      if (createRes.created > 0) {
        // Re-fetch to get IDs of new accounts
        const refreshed = await getAccounts(auth.token);
        const items = refreshed.items || refreshed;
        const newIds = items
          .filter((a: any) => bulkParsed.includes(a.account_identifier))
          .slice(0, 10)
          .map((a: any) => a.id);
        if (newIds.length > 0) {
          connectRes = await bulkConnectAccounts(auth.token, newIds);
        }
      }
      setBulkResult({ created: createRes.created, errors: createRes.errors, sent: connectRes.sent, failed: connectRes.failed });
      load();
    } catch (e: any) {
      setBulkResult({ created: 0, errors: [e?.message || t("accounts.importFailed")], sent: 0, failed: [] });
    } finally {
      setBulkBusy(false);
    }
  };

  const stats = {
    total: accounts.length,
    connected: Object.values(tgStatuses).filter((s) => s.connected).length,
    warming: accounts.filter((a) => a.status === "warming_up").length,
    banned: accounts.filter((a) => a.status === "banned").length,
  };

  const statusLabels = getStatusLabels(t);

  return (
    <div className={`p-6 space-y-6 animate-fade-slide-in`}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-100">{t("accounts.title")}</h1>
        <div className="flex gap-3">
          <button onClick={() => { setShowBulk(!showBulk); setBulkResult(null); }}
            className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg text-sm font-medium border border-zinc-700 hover:bg-zinc-700">
            {t("accounts.bulkImport")}
          </button>
          <button onClick={() => setShowAdd(!showAdd)}
            className="px-4 py-2 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-200 btn-press">
            {t("accounts.addAccount")}
          </button>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h2 className="text-sm font-medium text-zinc-300 mb-3">{t("accounts.howItWorks")}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs text-zinc-400">
          <div className="flex items-start gap-2">
            <span className="text-emerald-400 font-bold text-sm">1</span>
            <div><strong className="text-zinc-300">{t("accounts.step1Title")}</strong> — {t("accounts.step1Desc")}</div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-emerald-400 font-bold text-sm">2</span>
            <div><strong className="text-zinc-300">{t("accounts.step2Title")}</strong> — {t("accounts.step2Desc")}</div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-emerald-400 font-bold text-sm">3</span>
            <div><strong className="text-zinc-300">{t("accounts.step3Title")}</strong> — {t("accounts.step3Desc")}</div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-emerald-400 font-bold text-sm">4</span>
            <div><strong className="text-zinc-300">{t("accounts.step4Title")}</strong> — {t("accounts.step4Desc")}</div>
          </div>
        </div>
      </div>

      {/* Add Account Form */}
      {showAdd && (
        <form onSubmit={handleAdd} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-medium text-zinc-400">{t("accounts.addNew")}</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">{t("accounts.platform")}</label>
              <select value={addPlatform} onChange={(e) => setAddPlatform(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100">
                <option value="telegram">{t("accounts.telegram")}</option>
                <option value="vkontakte">{t("accounts.vkontakte")}</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">{t("accounts.phoneNumber")}</label>
              <input type="tel" placeholder={t("accounts.phonePlaceholder")} required value={addPhone} onChange={(e) => setAddPhone(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100" />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={addSaving || !addPhone}
              className="px-4 py-2 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-medium disabled:opacity-50">
              {addSaving ? t("accounts.adding") : t("accounts.addBtn")}
            </button>
            <button type="button" onClick={() => setShowAdd(false)}
              className="px-4 py-2 bg-zinc-800 text-zinc-400 rounded-lg text-sm">{t("accounts.cancel")}</button>
          </div>
        </form>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t("accounts.statTotal"), value: stats.total, color: "text-zinc-100" },
          { label: t("accounts.statConnected"), value: stats.connected, color: "text-emerald-400" },
          { label: t("accounts.statWarming"), value: stats.warming, color: "text-amber-400" },
          { label: t("accounts.statBanned"), value: stats.banned, color: "text-rose-400" },
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
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">{t("accounts.colTgStatus")}</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">{t("accounts.colIdentifier")}</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">{t("accounts.colPlatform")}</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">{t("accounts.colStatus")}</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">{t("accounts.colWarmup")}</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">{t("accounts.colQuota")}</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">{t("accounts.colActions")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8">
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex gap-4">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  ))}
                </div>
              </td></tr>
            ) : accounts.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                <p className="mb-2 text-zinc-300 font-medium">{t("accounts.empty")}</p>
                <p className="text-xs text-zinc-500 mb-3">{t("accounts.emptyDesc")}</p>
                <p className="text-xs text-zinc-600">{t("accounts.emptyHint")}</p>
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
                          {tgConnected ? t("accounts.tgOnline") : tgHasSession ? t("accounts.tgSession") : t("accounts.tgNoSession")}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-100 font-mono text-xs">{acct.account_identifier}</td>
                    <td className="px-4 py-3 text-zinc-400 capitalize">{acct.platform}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[acct.status] ?? ""}`}>
                        {statusLabels[acct.status] ?? acct.status}
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
                        {acct.platform === "vkontakte" ? (
                          !tgHasSession ? (
                            <button onClick={() => { setVkModal(acct.id); setVkToken(""); setVkError(""); }}
                              className="px-2.5 py-1 text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded hover:bg-emerald-500/20 transition">
                              {t("accounts.connectVk")}
                            </button>
                          ) : null
                        ) : !tgHasSession ? (
                          <button onClick={() => handleConnectStart(acct.id)}
                            className="px-2.5 py-1 text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded hover:bg-emerald-500/20 transition">
                            {t("accounts.connectTg")}
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
                              {actionBusy === acct.id ? "..." : listenerActive ? t("accounts.stop") : t("accounts.listen")}
                            </button>
                            <button onClick={() => handleDisconnect(acct.id)}
                              disabled={actionBusy === acct.id || listenerActive}
                              className="px-2.5 py-1 text-xs text-zinc-500 hover:text-rose-400 border border-zinc-700 rounded hover:border-rose-500/30 transition disabled:opacity-40"
                              title={t("accounts.disconnect")}>
                              {t("accounts.disconnect")}
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
                <h2 className="text-lg font-bold text-zinc-100">{t("accounts.connectTitle")}</h2>
                <p className="text-xs text-zinc-500">{t("accounts.connectDesc")}</p>
                <input type="tel" placeholder={t("accounts.phonePlaceholder")} value={connectPhone}
                  onChange={(e) => setConnectPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100" />
                {connectError && <p className="text-xs text-rose-400">{connectError}</p>}
                <div className="flex gap-3">
                  <button onClick={handleConnectSendCode} disabled={connectBusy || !connectPhone}
                    className="flex-1 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                    {connectBusy ? t("accounts.sending") : t("accounts.sendCode")}
                  </button>
                  <button onClick={() => setConnectModal(null)}
                    className="flex-1 py-2 bg-zinc-800 text-zinc-400 rounded-lg text-sm">{t("accounts.cancel")}</button>
                </div>
              </>
            ) : connectModal.step === "code" ? (
              <>
                <h2 className="text-lg font-bold text-zinc-100">{t("accounts.enterCode")}</h2>
                <p className="text-xs text-zinc-500">{t("accounts.enterCodeDesc")} <strong className="text-zinc-300">{connectPhone}</strong></p>
                <input type="text" placeholder={t("accounts.codePlaceholder")} value={connectCode}
                  onChange={(e) => setConnectCode(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 font-mono text-center text-lg tracking-widest" />
                {connectError && <p className="text-xs text-rose-400">{connectError}</p>}
                <p className="text-[10px] text-zinc-600">{t("accounts.codeHint")}</p>
                <div className="flex gap-3">
                  <button onClick={handleConnectConfirm} disabled={connectBusy || !connectCode}
                    className="flex-1 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                    {connectBusy ? t("accounts.connecting") : t("accounts.confirm")}
                  </button>
                  <button onClick={handleConnectSendCode} disabled={connectBusy}
                    className="py-2 px-3 bg-zinc-800 text-zinc-400 border border-zinc-700 rounded-lg text-xs hover:bg-zinc-700 transition disabled:opacity-50 whitespace-nowrap">
                    {connectBusy ? "..." : t("accounts.resendCode")}
                  </button>
                  <button onClick={() => setConnectModal(null)}
                    className="py-2 px-3 bg-zinc-800 text-zinc-400 rounded-lg text-xs">{t("accounts.cancel")}</button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-lg font-bold text-zinc-100">{t("accounts.twofaTitle")}</h2>
                <p className="text-xs text-zinc-500">{t("accounts.twofaDesc")}</p>
                <input type="password" placeholder={t("accounts.twofaPlaceholder")} value={connectPassword}
                  onChange={(e) => setConnectPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleConnectPassword()}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100" />
                {connectError && <p className="text-xs text-rose-400">{connectError}</p>}
                <p className="text-[10px] text-zinc-600">{t("accounts.twofaHint")}</p>
                <div className="flex gap-3">
                  <button onClick={handleConnectPassword} disabled={connectBusy || !connectPassword}
                    className="flex-1 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                    {connectBusy ? t("accounts.authorizing") : t("accounts.confirmPassword")}
                  </button>
                  <button onClick={() => setConnectModal(null)}
                    className="flex-1 py-2 bg-zinc-800 text-zinc-400 rounded-lg text-sm">{t("accounts.cancel")}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── VK Connect Modal ────────────────────────────────────────────── */}
      {vkModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setVkModal(null)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-zinc-100">{t("accounts.vkConnectTitle")}</h2>
            <p className="text-xs text-zinc-500">{t("accounts.vkConnectDesc")}</p>
            <input type="text" placeholder={t("accounts.vkTokenPlaceholder")} value={vkToken}
              onChange={(e) => setVkToken(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 font-mono" />
            {vkError && <p className="text-xs text-rose-400">{vkError}</p>}
            <p className="text-[10px] text-zinc-600">{t("accounts.vkTokenHint")}</p>
            <div className="flex gap-3">
              <button onClick={handleVkConnect} disabled={vkBusy || !vkToken.trim()}
                className="flex-1 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {vkBusy ? t("accounts.connecting") : t("accounts.connectVk")}
              </button>
              <button onClick={() => setVkModal(null)}
                className="flex-1 py-2 bg-zinc-800 text-zinc-400 rounded-lg text-sm">{t("accounts.cancel")}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Import Modal ──────────────────────────────────────────── */}
      {showBulk && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowBulk(false)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-lg space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-zinc-100">{t("accounts.bulkTitle")}</h2>
            <p className="text-xs text-zinc-500">{t("accounts.bulkDesc")}</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">{t("accounts.platform")}</label>
                <select value={bulkPlatform} onChange={(e) => setBulkPlatform(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100">
                  <option value="telegram">{t("accounts.telegram")}</option>
                  <option value="vkontakte">{t("accounts.vkontakte")}</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">{t("accounts.bulkCount", { count: String(bulkParsed.length) })}</label>
                <p className="text-[10px] text-zinc-600 mt-2">{t("accounts.bulkMax")}</p>
              </div>
            </div>

            <textarea
              placeholder={bulkPlatform === "telegram" ? "+1234567890\n+0987654321" : "group_token_abc123\ngroup_token_def456"}
              value={bulkPhones}
              onChange={(e) => { setBulkPhones(e.target.value); setBulkResult(null); }}
              rows={8}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 font-mono resize-none"
            />

            {/* Preview */}
            {bulkParsed.length > 0 && (
              <div className="text-xs text-zinc-500">
                {t("accounts.bulkPreview", { preview: bulkParsed.slice(0, 5).join(", ") + (bulkParsed.length > 5 ? ` ... +${bulkParsed.length - 5} more` : "") })}
              </div>
            )}

            {/* Result */}
            {bulkResult && (
              <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 text-xs space-y-1">
                <p className="text-emerald-400">{t("accounts.bulkCreated", { created: String(bulkResult.created) })}</p>
                <p className="text-emerald-400">{t("accounts.bulkSent", { sent: String(bulkResult.sent) })}</p>
                {bulkResult.errors.length > 0 && (
                  <p className="text-rose-400">{t("accounts.bulkErrors", { errors: bulkResult.errors.join("; ") })}</p>
                )}
                {bulkResult.failed.length > 0 && (
                  <p className="text-rose-400">{t("accounts.bulkFailed", { failed: bulkResult.failed.join("; ") })}</p>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={handleBulkImport} disabled={bulkBusy || bulkParsed.length === 0}
                className="flex-1 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {bulkBusy ? t("accounts.importing") : t("accounts.importSendCodes")}
              </button>
              <button onClick={() => setShowBulk(false)}
                className="flex-1 py-2 bg-zinc-800 text-zinc-400 rounded-lg text-sm">{t("accounts.cancel")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
