"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { getWhatsAppQr, getWhatsAppStatus } from "@/lib/api";

type Props = {
  accountId: string;
  onClose: () => void;
  onConnected: () => void;
};

export function WaQRModal({ accountId, onClose, onConnected }: Props) {
  const { auth } = useAuth();
  const { t } = useI18n();
  const [qr, setQr] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "polling" | "connected" | "error">("loading");
  const [error, setError] = useState("");

  const fetchQr = useCallback(async () => {
    if (!auth?.token) return;
    setStatus("loading");
    setError("");
    try {
      const res = await getWhatsAppQr(auth.token, accountId);
      if (res?.qr) {
        setQr(res.qr);
        setStatus("polling");
      } else {
        setError(t("accounts.waConnectFailed"));
        setStatus("error");
      }
    } catch (e: any) {
      setError(e?.message || t("accounts.waConnectFailed"));
      setStatus("error");
    }
  }, [auth?.token, accountId, t]);

  useEffect(() => { fetchQr(); }, [fetchQr]);

  // Poll connection status
  useEffect(() => {
    if (status !== "polling" || !auth?.token) return;
    const interval = setInterval(async () => {
      try {
        const res = await getWhatsAppStatus(auth.token!, accountId);
        if (res?.connected) {
          clearInterval(interval);
          setStatus("connected");
          setTimeout(onConnected, 800);
        }
      } catch {
        // keep polling
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [status, auth?.token, accountId, onConnected]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-zinc-100">{t("accounts.waConnectTitle")}</h2>
        <p className="text-xs text-zinc-500">{t("accounts.waConnectDesc")}</p>

        <div className="flex items-center justify-center min-h-[200px] bg-zinc-800 rounded-lg border border-zinc-700">
          {status === "loading" && (
            <div className="w-6 h-6 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin" />
          )}
          {status === "error" && (
            <p className="text-xs text-rose-400 px-4 text-center">{error}</p>
          )}
          {(status === "polling" || status === "ready") && qr && (
            <img src={qr} alt="QR Code" className="w-48 h-48" />
          )}
          {status === "connected" && (
            <div className="text-center">
              <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm text-emerald-400 font-medium">{t("accounts.waConnected")}</p>
            </div>
          )}
        </div>

        {status === "polling" && (
          <p className="text-[10px] text-zinc-500 text-center">{t("accounts.waQrReady")}</p>
        )}

        <div className="flex gap-3">
          {status === "error" && (
            <button onClick={fetchQr}
              className="flex-1 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium">
              {t("accounts.waScanQr")}
            </button>
          )}
          <button onClick={onClose}
            className="flex-1 py-2 bg-zinc-800 text-zinc-400 rounded-lg text-sm">
            {status === "connected" ? "✓" : "Cancel"}
          </button>
        </div>
      </div>
    </div>
  );
}
