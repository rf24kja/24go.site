"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { getWaAccounts, connectWhatsApp, disconnectWhatsApp, deleteWhatsApp, getWhatsAppStatus } from "@/lib/api";
import { Skeleton } from "@/components/Skeleton";
import { WaQRModal } from "@/components/WaQRModal";

type Account = { id: string; phone_number: string; status: string; created_at: string };

export default function WaAccountsPage() {
  const { auth } = useAuth();
  const { t } = useI18n();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  // Connect flow
  const [showConnect, setShowConnect] = useState(false);
  const [connectMethod, setConnectMethod] = useState<"qr" | "pairing-code" | "existing">("qr");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState("");

  // QR modal
  const [showQr, setShowQr] = useState<string | null>(null);

  const load = () => {
    if (!auth?.token) return;
    setLoading(true);
    getWaAccounts(auth.token)
      .then((res) => setAccounts(res.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [auth?.token]);

  const handleConnect = async () => {
    if (!auth?.token || !phoneNumber.trim()) return;
    setConnecting(true);
    setConnectError("");
    try {
      const res = await connectWhatsApp(auth.token, { phone_number: phoneNumber.trim(), method: connectMethod });
      setShowConnect(false);
      setPhoneNumber("");
      if (connectMethod === "qr" || connectMethod === "existing") {
        setShowQr(res.account_id);
      } else {
        load();
      }
    } catch (e: any) {
      setConnectError(e?.message || t("accounts.waConnectFailed"));
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async (id: string) => {
    if (!auth?.token || !confirm(t("accounts.waDisconnectConfirm"))) return;
    setActionBusy(id);
    try {
      await disconnectWhatsApp(auth.token, id);
      load();
    } catch { /* silent */ } finally {
      setActionBusy(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!auth?.token || !confirm(t("accounts.deleteConfirm"))) return;
    setActionBusy(id);
    try {
      await deleteWhatsApp(auth.token, id);
      load();
    } catch { /* silent */ } finally {
      setActionBusy(null);
    }
  };

  const statusColor = (s: string) =>
    s === "connected" ? "bg-emerald-400" : s === "connecting" ? "bg-yellow-400 animate-pulse" : "bg-zinc-600";

  return (
    <div className="p-6 space-y-6 animate-fade-slide-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-zinc-100">{t("sidebar.waAccounts")}</h1>
        <button onClick={() => setShowConnect(true)}
          className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition">
          {t("waAccounts.connect")}
        </button>
      </div>

      {/* Accounts table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[480px]">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">{t("waAccounts.status")}</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Phone</th>
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
                <p className="mb-2 text-zinc-300 font-medium">{t("accounts.empty")}</p>
                <button onClick={() => setShowConnect(true)}
                  className="text-xs text-emerald-400 hover:text-emerald-300 underline">
                  {t("waAccounts.connect")}
                </button>
              </td></tr>
            ) : (
              accounts.map((acct) => (
                <tr key={acct.id} className="border-b border-zinc-800 last:border-0 hover:bg-zinc-800/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${statusColor(acct.status)}`} />
                      <span className="text-xs text-zinc-400">
                        {t(`waAccounts.status.${acct.status}`)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-100 font-mono text-xs">{acct.phone_number}</td>
                  <td className="px-4 py-3 text-zinc-400 hidden md:table-cell">
                    {new Date(acct.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {acct.status === "connected" ? (
                        <button onClick={() => handleDisconnect(acct.id)}
                          disabled={actionBusy === acct.id}
                          className="px-3 py-1.5 text-xs text-zinc-500 hover:text-rose-400 border border-zinc-700 rounded hover:border-rose-500/30 transition disabled:opacity-40">
                          {t("waAccounts.disconnect")}
                        </button>
                      ) : (
                        <button onClick={() => setShowQr(acct.id)}
                          className="px-3 py-1.5 text-xs bg-green-500/10 text-green-400 border border-green-500/20 rounded hover:bg-green-500/20 transition">
                          {t("waAccounts.qrMethod")}
                        </button>
                      )}
                      <button onClick={() => handleDelete(acct.id)}
                        disabled={actionBusy === acct.id}
                        className="px-3 py-1.5 text-xs text-zinc-500 hover:text-rose-400 border border-zinc-700 rounded hover:border-rose-500/30 transition disabled:opacity-40">
                        {t("waAccounts.delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Connect modal */}
      {showConnect && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowConnect(false)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-zinc-100">{t("waAccounts.connect")}</h2>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Phone Number</label>
              <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+1234567890"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-emerald-500" />
            </div>

            <div className="space-y-2">
              <label className="block text-xs text-zinc-400">Connection Method</label>
              {([
                ["qr", t("waAccounts.qrMethod")],
                ["pairing-code", t("waAccounts.pairingMethod")],
                ["existing", t("waAccounts.existingMethod")],
              ] as const).map(([val, label]) => (
                <label key={val} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="method" value={val} checked={connectMethod === val}
                    onChange={() => setConnectMethod(val)}
                    className="w-4 h-4 text-emerald-500 bg-zinc-800 border-zinc-600 focus:ring-emerald-500" />
                  <span className="text-sm text-zinc-300">{label}</span>
                </label>
              ))}
            </div>

            {connectError && <p className="text-xs text-rose-400">{connectError}</p>}

            <div className="flex gap-3">
              <button onClick={handleConnect} disabled={connecting || !phoneNumber.trim()}
                className="flex-1 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium disabled:opacity-40">
                {connecting ? t("accounts.connecting") : t("waAccounts.connect")}
              </button>
              <button onClick={() => setShowConnect(false)}
                className="flex-1 py-2 bg-zinc-800 text-zinc-400 rounded-lg text-sm">
                {t("accounts.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

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
