"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { fbConnect, getAccounts } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Skeleton } from "@/components/Skeleton";

type FbAccount = {
  id: string;
  account_identifier: string;
  status: string;
  created_at: string;
};

export default function FbConnectPage() {
  const { auth } = useAuth();
  const { toast } = useToast();
  const { t } = useI18n();
  const [accounts, setAccounts] = useState<FbAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [cUser, setCUser] = useState("");
  const [xs, setXs] = useState("");

  const load = useCallback(() => {
    if (!auth?.token) return;
    setLoading(true);
    getAccounts(auth.token, { platform: "facebook" })
      .then((res) => setAccounts(res.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [auth?.token]);

  useEffect(() => { load(); }, [load]);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.token) return;
    setSaving(true);
    try {
      await fbConnect(auth.token, {
        profile_name: profileName.trim(),
        c_user: cUser.trim(),
        xs: xs.trim(),
      });
      toast(t("fbConnect.saved"), "success");
      setProfileName("");
      setCUser("");
      setXs("");
      load();
    } catch (err: any) {
      toast(err.message || t("fbConnect.saveFailed"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl animate-fade-slide-in">
      <h1 className="text-2xl font-bold">{t("fbConnect.title")}</h1>
      <p className="text-sm text-zinc-400">{t("fbConnect.desc")}</p>

      <form onSubmit={handleConnect} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
        <div>
          <label className="text-xs text-zinc-500 block mb-1">{t("fbConnect.profileName")}</label>
          <input value={profileName} onChange={(e) => setProfileName(e.target.value)} required maxLength={255}
            placeholder={t("fbConnect.profilePlaceholder")}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-500" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-zinc-500 block mb-1">c_user</label>
            <input value={cUser} onChange={(e) => setCUser(e.target.value)} required inputMode="numeric"
              placeholder="1234567890"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 font-mono" />
          </div>
          <div>
            <label className="text-xs text-zinc-500 block mb-1">xs</label>
            <input value={xs} onChange={(e) => setXs(e.target.value)} required type="password"
              placeholder="••••••••"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 font-mono" />
          </div>
        </div>
        <p className="text-xs text-zinc-500">{t("fbConnect.howTo")}</p>
        <button type="submit" disabled={saving}
          className="px-4 py-2 bg-sky-600 text-white rounded-lg text-sm hover:bg-sky-500 disabled:opacity-50 btn-press">
          {saving ? "..." : t("fbConnect.connect")}
        </button>
      </form>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800 text-sm font-medium text-zinc-300">{t("fbConnect.connected")}</div>
        {loading ? (
          <div className="p-4 space-y-3">{[1, 2].map((i) => <Skeleton key={i} className="h-4 w-48" />)}</div>
        ) : accounts.length === 0 ? (
          <p className="p-4 text-sm text-zinc-500">{t("fbConnect.empty")}</p>
        ) : (
          <ul className="divide-y divide-zinc-800">
            {accounts.map((a) => (
              <li key={a.id} className="px-4 py-3 flex items-center justify-between text-sm">
                <span className="text-zinc-100 font-medium">{a.account_identifier}</span>
                <span className={`px-2 py-0.5 rounded text-xs ${a.status === "active" ? "bg-emerald-500/20 text-emerald-400" : a.status === "paused" ? "bg-amber-500/20 text-amber-400" : "bg-zinc-800 text-zinc-400"}`}>
                  {a.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
