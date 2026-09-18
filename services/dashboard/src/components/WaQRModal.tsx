"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { getWhatsAppQr, getWhatsAppPairingCode, getWhatsAppStatus } from "@/lib/api";

type Props = {
  accountId: string;
  onClose: () => void;
  onConnected: () => void;
};

export function WaQRModal({ accountId, onClose, onConnected }: Props) {
  const { auth } = useAuth();
  const { t } = useI18n();
  const [mode, setMode] = useState<"qr" | "pairing">("qr");
  const [qr, setQr] = useState("");
  const [pairingCode, setPairingCode] = useState("");
  const [countdown, setCountdown] = useState(15);
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
        setCountdown(15);
      } else {
        setError(t("accounts.waConnectFailed"));
        setStatus("error");
      }
    } catch (e: any) {
      setError(e?.message || t("accounts.waConnectFailed"));
      setStatus("error");
    }
  }, [auth?.token, accountId, t]);

  const fetchPairingCode = useCallback(async () => {
    if (!auth?.token) return;
    setStatus("loading");
    setError("");
    try {
      const res = await getWhatsAppPairingCode(auth.token, accountId);
      if (res?.code) {
        setPairingCode(res.code);
        setStatus("polling");
        setCountdown(120);
      } else {
        setError(t("accounts.waConnectFailed"));
        setStatus("error");
      }
    } catch (e: any) {
      setError(e?.message || t("accounts.waConnectFailed"));
      setStatus("error");
    }
  }, [auth?.token, accountId, t]);

  useEffect(() => {
    if (mode === "qr") fetchQr();
    else fetchPairingCode();
  }, [mode, fetchQr, fetchPairingCode]);

  // Countdown timer
  useEffect(() => {
    if (status !== "polling" || countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Auto-refresh
          if (mode === "qr") fetchQr();
          else fetchPairingCode();
          return mode === "qr" ? 15 : 120;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [status, countdown, mode, fetchQr, fetchPairingCode]);

  // Poll connection status
  useEffect(() => {
    if (status !== "polling" || !auth?.token) return;
    const interval = setInterval(async () => {
      try {
        const res = await getWhatsAppStatus(auth.token!, accountId);
        if (res?.status === "connected") {
          clearInterval(interval);
          setStatus("connected");
          setTimeout(onConnected, 800);
        }
      } catch { /* keep polling */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [status, auth?.token, accountId, onConnected]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-zinc-100">{t("accounts.waConnectTitle")}</h2>

        {/* Mode tabs */}
        <div className="flex gap-2">
          <button onClick={() => setMode("qr")}
            className={`flex-1 py-1.5 text-xs rounded-lg border transition ${mode === "qr" ? "border-emerald-500 text-emerald-400 bg-emerald-500/10" : "border-zinc-700 text-zinc-400"}`}>
            {t("waAccounts.qrMethod")}
          </button>
          <button onClick={() => setMode("pairing")}
            className={`flex-1 py-1.5 text-xs rounded-lg border transition ${mode === "pairing" ? "border-emerald-500 text-emerald-400 bg-emerald-500/10" : "border-zinc-700 text-zinc-400"}`}>
            {t("waAccounts.pairingMethod")}
          </button>
        </div>

        <div className="flex items-center justify-center min-h-[200px] bg-zinc-800 rounded-lg border border-zinc-700">
          {status === "loading" && (
            <div className="w-6 h-6 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin" />
          )}
          {status === "error" && (
            <p className="text-xs text-rose-400 px-4 text-center">{error}</p>
          )}
          {status === "polling" && mode === "qr" && qr && (
            <img src={qr} alt="QR Code" className="w-48 h-48" />
          )}
          {status === "polling" && mode === "pairing" && pairingCode && (
            <div className="text-center px-4">
              <p className="text-3xl font-mono font-bold text-zinc-100 tracking-wider">{pairingCode}</p>
              <p className="text-xs text-zinc-500 mt-2">{t("waAccounts.enterCode")}</p>
            </div>
          )}
          {status === "connected" && (
            <div className="text-center">
              <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm text-emerald-400 font-medium">{t("waAccounts.status.connected")}</p>
            </div>
          )}
        </div>

        {status === "polling" && (
          <p className="text-[10px] text-zinc-500 text-center">
            {mode === "qr" ? t("waAccounts.scanQR") : t("waAccounts.enterCode")}
            {" "}{t("waAccounts.updatesIn")} {countdown}s
          </p>
        )}

        <div className="flex gap-3">
          {status === "error" && (
            <button onClick={() => mode === "qr" ? fetchQr() : fetchPairingCode()}
              className="flex-1 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium">
              {t("waAccounts.connect")}
            </button>
          )}
          <button onClick={onClose}
            className="flex-1 py-2 bg-zinc-800 text-zinc-400 rounded-lg text-sm">
            {status === "connected" ? "✓" : t("accounts.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
