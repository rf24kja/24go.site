"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { getAccounts, getWhatsAppStatus, disconnectWhatsApp, deleteTelegram } from "@/lib/api";
import { Skeleton } from "@/components/Skeleton";
import { WaQRModal } from "@/components/WaQRModal";

type Account = {
  id: string;
  account_identifier: string;
  platform: string;
  status: string;
};

type WaStatus = {
  connected: boolean;
  status: string;
  parses_today?: number;
  parse_limit?: number;
};

export default function WaAccountsPage() {
  const { auth } = useAuth();
  const { t } = useI18n();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [waStatuses, setWaStatuses] = useState<Record<string, WaStatus>>({});
  const [loading, setLoading] = useState(true);
  const [showQr, setShowQr] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const load = () => {
    if (!auth?.token) return;
    setLoading(true);
    getAccounts(auth.token, { platform: "whatsapp" })
      .then(async (accts) => {
        const items = accts.items || accts;
        setAccounts(items);
        const statuses: Record<string, WaStatus> = {};
        const results = await Promise.allSettled(
          items.map((a: Account) => getWhatsAppStatus(auth.token!, a.id))
        );
        items.forEach((a: Account, i: number) => {
          const r = results[i];
          statuses[a.id] = r.status === "fulfilled" ? r.value : { connected: false, status: "unknown" };
        });
        setWaStatuses(statuses);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [auth?.token]);

  const handleDisconnect = async (id: string) => {
    if (!auth?.token || !confirm(t("accounts.waDisconnectConfirm"))) return;
    setActionBusy(id);
    try {
      await disconnectWhatsApp(auth.token, id);
      load();
    } catch {
      // silent
    } finally {
      setActionBusy(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!auth?.token || !confirm(t("accounts.deleteConfirm"))) return;
    setActionBusy(id);
    try {
      await deleteTelegram(auth.token, id);
      load();
    } catch {
      // silent
    } finally {
      setActionBusy(null);
    }
  };

  return (
    <div className="p-6 space-y-6 animate-fade-slide-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-zinc-100">{t("sidebar.waAccounts")}</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: t("accounts.statTotal"), value: accounts.length, color: "text-zinc-100" },
          { label: t("accounts.waConnected"), value: Object.values(waStatuses).filter((s) => s.connected).length, color: "text-emerald-400" },
          { label: t("accounts.waParsesToday"), value: Object.values(waStatuses).reduce((sum, s) => sum + (s.parses_today || 0), 0), color: "text-blue-400" },
        ].map((s) => (
          <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-zinc-500 text-xs mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Accounts table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[480px]">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Status</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Phone</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium hidden md:table-cell">{t("accounts.waParsesToday")}</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium hidden md:table-cell">{t("accounts.waParseLimit")}</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8">
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex gap-4">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  ))}
                </div>
              </td></tr>
            ) : accounts.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                <p className="mb-2 text-zinc-300 font-medium">{t("accounts.empty")}</p>
                <p className="text-xs text-zinc-500">Click &quot;Connect WhatsApp&quot; to add your first account.</p>
              </td></tr>
            ) : (
              accounts.map((acct) => {
                const ws = waStatuses[acct.id];
                const connected = ws?.connected ?? false;

                return (
                  <tr key={acct.id} className="border-b border-zinc-800 last:border-0 hover:bg-zinc-800/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"}`} />
                        <span className="text-xs text-zinc-400">
                          {connected ? t("accounts.waConnected") : t("accounts.tgNoSession")}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-100 font-mono text-xs">{acct.account_identifier}</td>
                    <td className="px-4 py-3 text-zinc-400 hidden md:table-cell">{ws?.parses_today ?? "—"}</td>
                    <td className="px-4 py-3 text-zinc-400 hidden md:table-cell">{ws?.parse_limit ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {!connected ? (
                          <button onClick={() => setShowQr(acct.id)}
                            className="px-3 py-1.5 text-xs bg-green-500/10 text-green-400 border border-green-500/20 rounded hover:bg-green-500/20 transition min-h-[36px]">
                            {t("accounts.waScanQr")}
                          </button>
                        ) : (
                          <button onClick={() => handleDisconnect(acct.id)}
                            disabled={actionBusy === acct.id}
                            className="px-3 py-1.5 text-xs text-zinc-500 hover:text-rose-400 border border-zinc-700 rounded hover:border-rose-500/30 transition disabled:opacity-40 min-h-[36px]">
                            {t("accounts.disconnect")}
                          </button>
                        )}
                        <button onClick={() => handleDelete(acct.id)}
                          disabled={actionBusy === acct.id}
                          className="px-3 py-1.5 text-xs text-zinc-500 hover:text-rose-400 border border-zinc-700 rounded hover:border-rose-500/30 transition disabled:opacity-40 min-h-[36px]"
                          title={t("accounts.delete")}>
                          {t("accounts.delete")}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showQr && (
        <WaQRModal
          accountId={showQr}
          onClose={() => setShowQr(null)}
          onConnected={() => { setShowQr(null); load(); }}
        />
      )}
    </div>
  );
}
