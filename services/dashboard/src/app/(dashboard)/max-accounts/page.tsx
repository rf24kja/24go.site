"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { getMaxAccounts, connectMax, deleteMaxAccount, getMaxStatus } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { MaxWebhook } from "@/components/MaxWebhook";
import { Skeleton } from "@/components/Skeleton";

type Account = { id: string; bot_name: string; status: string; created_at: string; webhook_configured?: boolean };

export default function MaxAccountsPage() {
  const { auth } = useAuth();
  return <MaxAccountsContent key={auth?.token || "signed-out"} />;
}

function MaxAccountsContent() {
  const { auth } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const [showConnect, setShowConnect] = useState(false);
  const [botToken, setBotToken] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState("");
  // ponytail: shown once after connect — server never returns it again
  const [webhookSecret, setWebhookSecret] = useState<{accountId: string; secret: string} | null>(null);

  useEffect(() => { setWebhookSecret(null); setBotToken(""); setShowConnect(false); }, [auth?.token]);

  const load = () => {
    if (!auth?.token) return;
    setLoading(true);
    getMaxAccounts(auth.token)
      .then((res) => setAccounts(res.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [auth?.token]);

  const handleConnect = async () => {
    if (!auth?.token || !botToken.trim()) return;
    setConnecting(true);
    setConnectError("");
    try {
      const res: any = await connectMax(auth.token, botToken.trim());
      setShowConnect(false);
      setBotToken("");
      if (res?.webhook_secret) setWebhookSecret({accountId: res.id, secret: res.webhook_secret});
      load();
      toast(t("maxAccounts.status.connected"), "success");
    } catch (e: any) {
      const msg = e?.status === 401 ? t("maxAccounts.invalidToken") : (e?.message || t("maxAccounts.connectFailed"));
      setConnectError(msg);
    } finally {
      setConnecting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!auth?.token || !confirm(t("maxAccounts.disconnectConfirm"))) return;
    setActionBusy(id);
    try {
      await deleteMaxAccount(auth.token, id);
      load();
    } catch (e: any) {
      toast(e?.message || t("maxAccounts.deleteFailed"), "error");
    } finally {
      setActionBusy(null);
    }
  };

  const handleRefreshStatus = async (id: string) => {
    if (!auth?.token) return;
    setActionBusy(id);
    try {
      const res = await getMaxStatus(auth.token, id);
      toast(res.connected ? t("maxAccounts.status.connected") : t("maxAccounts.status.disconnected"), res.connected ? "success" : "error");
      load();
    } catch (e: any) {
      toast(e?.message || t("maxAccounts.statusFailed"), "error");
    } finally {
      setActionBusy(null);
    }
  };

  const statusColor = (s: string) =>
    s === "connected" || s === "active" ? "bg-emerald-400"
    : s === "banned" ? "bg-rose-500"
    : s === "connecting" ? "bg-yellow-400 animate-pulse" : "bg-zinc-600";

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      connected: t("maxAccounts.status.connected"),
      active: t("maxAccounts.status.connected"),
      disconnected: t("maxAccounts.status.disconnected"),
      paused: t("maxAccounts.status.disconnected"),
      connecting: t("maxAccounts.status.connecting"),
      warming_up: t("maxAccounts.status.connecting"),
      banned: t("maxAccounts.status.banned"),
      cooldown: t("maxAccounts.status.cooldown"),
    };
    return map[s] || s;
  };

  return (
    <div className="p-6 space-y-6 animate-fade-slide-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-zinc-100">{t("maxAccounts.title")}</h1>
        <button onClick={() => setShowConnect(true)}
          className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition">
          {t("maxAccounts.connect")}
        </button>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[480px]">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">{t("maxAccounts.status")}</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Bot</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium hidden md:table-cell">Connected Since</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-8">
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex gap-4">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  ))}
                </div>
              </td></tr>
            ) : accounts.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-zinc-500">
                <p className="mb-2 text-zinc-300 font-medium">{t("maxAccounts.empty")}</p>
                <button onClick={() => setShowConnect(true)}
                  className="text-xs text-emerald-400 hover:text-emerald-300 underline">
                  {t("maxAccounts.connect")}
                </button>
              </td></tr>
            ) : (
              accounts.map((acct) => (
                <tr key={acct.id} className="border-b border-zinc-800 last:border-0 hover:bg-zinc-800/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${statusColor(acct.status)}`} />
                      <span className="text-xs text-zinc-400">
                        {statusLabel(acct.status)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-100 font-mono text-xs">{acct.bot_name}
                    {auth?.token && <MaxWebhook key={`${auth.token}:${acct.id}`} token={auth.token} accountId={acct.id} configured={acct.webhook_configured} secret={webhookSecret?.accountId === acct.id ? webhookSecret.secret : undefined} clearSecret={() => setWebhookSecret(null)} />}
                  </td>
                  <td className="px-4 py-3 text-zinc-400 hidden md:table-cell">
                    {acct.created_at ? new Date(acct.created_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => handleRefreshStatus(acct.id)}
                        disabled={actionBusy === acct.id}
                        className="px-3 py-1.5 text-xs bg-green-500/10 text-green-400 border border-green-500/20 rounded hover:bg-green-500/20 transition disabled:opacity-40">
                        {t("maxAccounts.status")}
                      </button>
                      <button onClick={() => handleDelete(acct.id)}
                        disabled={actionBusy === acct.id}
                        className="px-3 py-1.5 text-xs text-zinc-500 hover:text-rose-400 border border-zinc-700 rounded hover:border-rose-500/30 transition disabled:opacity-40">
                        {t("maxAccounts.delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showConnect && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowConnect(false)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-zinc-100">{t("maxAccounts.connect")}</h2>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">{t("maxAccounts.tokenLabel")}</label>
              <input type="password" value={botToken} onChange={(e) => setBotToken(e.target.value)}
                placeholder={t("maxAccounts.tokenPlaceholder")}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-emerald-500" />
              <p className="text-[11px] text-zinc-500 mt-1">{t("maxAccounts.tokenHint")}</p>
            </div>

            {connectError && <p className="text-xs text-rose-400">{connectError}</p>}

            <div className="flex gap-3">
              <button onClick={handleConnect} disabled={connecting || !botToken.trim()}
                className="flex-1 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium disabled:opacity-40">
                {connecting ? t("maxAccounts.status.connecting") : t("maxAccounts.connect")}
              </button>
              <button onClick={() => setShowConnect(false)}
                className="flex-1 py-2 bg-zinc-800 text-zinc-400 rounded-lg text-sm">
                {t("accounts.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
