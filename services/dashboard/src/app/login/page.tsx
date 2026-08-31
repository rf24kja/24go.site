"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [company, setCompany] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const router = useRouter();
  const { t } = useI18n();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, password, company);
      }
      router.push("/analytics");
    } catch (err: any) {
      setError(err.message || t("login.authFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">
            24<span className="text-emerald-400">GO</span>
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            {mode === "login" ? t("login.signInTitle") : t("login.registerTitle")}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
          <div className="flex gap-2 mb-4">
            <button type="button" onClick={() => { setMode("login"); setError(""); }}
              className={`flex-1 py-1.5 text-sm rounded-lg transition ${mode === "login" ? "bg-zinc-100 text-zinc-900" : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"}`}>
              {t("login.signIn")}
            </button>
            <button type="button" onClick={() => { setMode("register"); setError(""); }}
              className={`flex-1 py-1.5 text-sm rounded-lg transition ${mode === "register" ? "bg-zinc-100 text-zinc-900" : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"}`}>
              {t("login.register")}
            </button>
          </div>

          {mode === "register" && (
            <input type="text" placeholder={t("login.companyPlaceholder")} value={company} onChange={(e) => setCompany(e.target.value)} required
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500" />
          )}

          <input type="email" placeholder={t("login.emailPlaceholder")} value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500" />

          <input type="password" placeholder={t("login.passwordPlaceholder")} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500" />

          {error && (
            <div className="px-3 py-2 bg-rose-500/10 border border-rose-500/20 rounded-lg">
              <p className="text-xs text-rose-400">{error}</p>
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full py-2.5 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition disabled:opacity-50">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                {mode === "login" ? t("login.signingIn") : t("login.creatingAccount")}
              </span>
            ) : mode === "login" ? t("login.signIn") : t("login.createAccount")}
          </button>

          {mode === "login" && (
            <p className="text-center text-xs text-zinc-500">
              <Link href="/forgot-password" className="hover:text-zinc-300 transition">{t("login.forgotPassword")}</Link>
            </p>
          )}
        </form>

        <p className="text-center text-xs text-zinc-600">
          <Link href="/" className="hover:text-zinc-400 transition">{t("login.backHome")}</Link>
        </p>
      </div>
    </div>
  );
}
