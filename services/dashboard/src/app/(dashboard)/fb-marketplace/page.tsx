"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { fbMarketplaceSearch, fbMarketplaceStatus, fbMarketplaceResults, getAccounts } from "@/lib/api";
import { useToast } from "@/components/Toast";

type Snapshot = {
  title: string; price: number | null; link: string; image?: string;
  bedrooms?: number | null; first_seen: string; last_seen: string;
};

export default function FbMarketplacePage() {
  const { auth } = useAuth();
  const { toast } = useToast();
  const { t } = useI18n();
  const [accounts, setAccounts] = useState<{ id: string; account_identifier: string }[]>([]);
  const [accountId, setAccountId] = useState("");
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [searching, setSearching] = useState(false);
  const [status, setStatus] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [items, setItems] = useState<Snapshot[]>([]);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadAccounts = useCallback(() => {
    if (!auth?.token) return;
    getAccounts(auth.token, { platform: "facebook" })
      .then((res) => {
        const list = res.items || [];
        setAccounts(list);
        if (list.length > 0) setAccountId((prev) => prev || list[0].id);
      })
      .catch(() => {});
  }, [auth?.token]);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);
  useEffect(() => () => { if (pollingRef.current) clearInterval(pollingRef.current); }, []);

  const poll = useCallback((jobId: string, q: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      if (!auth?.token) return;
      try {
        const job = await fbMarketplaceStatus(auth.token, jobId);
        setStatus(job.status);
        if (job.status === "done" || job.status === "failed") {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setSearching(false);
          setErrors(job.errors || (job.error ? [job.error] : []));
          if (job.status === "done") {
            const res = await fbMarketplaceResults(auth.token, q);
            setItems(res.items || []);
            toast(t("fbMarketplace.done"), "success");
          } else {
            toast(job.error || t("fbMarketplace.failed"), "error");
          }
        }
      } catch {}
    }, 4000);
  }, [auth?.token]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.token || !query.trim()) return;
    setSearching(true);
    setErrors([]);
    setItems([]);
    setStatus("queued");
    try {
      const job = await fbMarketplaceSearch(auth.token, {
        query: query.trim(),
        account_id: accountId || undefined,
        location: location.trim() || undefined,
      });
      poll(job.job_id, query.trim());
    } catch (err: any) {
      toast(err.message || t("fbMarketplace.failed"), "error");
      setSearching(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl animate-fade-slide-in">
      <h1 className="text-2xl font-bold">{t("fbMarketplace.title")}</h1>

      <form onSubmit={handleSearch} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-zinc-500 block mb-1">{t("fbMarketplace.query")}</label>
            <input value={query} onChange={(e) => setQuery(e.target.value)} required maxLength={200}
              placeholder={t("fbMarketplace.queryPlaceholder")}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-500" />
          </div>
          <div>
            <label className="text-xs text-zinc-500 block mb-1">{t("fbMarketplace.account")}</label>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100">
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.account_identifier}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs text-zinc-500 block mb-1">{t("fbMarketplace.location")}</label>
          <input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={100}
            placeholder={t("fbMarketplace.locationPlaceholder")}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-500" />
        </div>
        <button type="submit" disabled={searching || accounts.length === 0}
          className="px-4 py-2 bg-sky-600 text-white rounded-lg text-sm hover:bg-sky-500 disabled:opacity-50 btn-press">
          {searching ? `${t("fbMarketplace.searching")} (${status})` : t("fbMarketplace.search")}
        </button>
        {accounts.length === 0 && (
          <p className="text-xs text-amber-400">{t("fbMarketplace.noAccount")}</p>
        )}
      </form>

      {errors.length > 0 && (
        <div className="bg-rose-950/40 border border-rose-800 rounded-xl p-4 text-sm">
          {errors.map((e, i) => (
            <p key={i} className="text-rose-300 text-xs font-mono break-all">{e}</p>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 text-sm text-zinc-300">
            {items.length} {t("fbMarketplace.results")}
          </div>
          <ul className="divide-y divide-zinc-800">
            {items.map((it, i) => (
              <li key={i} className="px-4 py-3 text-sm">
                <a href={it.link} target="_blank" rel="noopener noreferrer"
                  className="text-zinc-100 font-medium hover:text-sky-400">
                  {it.title || it.link}
                </a>
                <div className="text-xs text-zinc-500 mt-1">
                  {it.price != null && <span className="text-emerald-400 font-medium mr-3">{it.price}</span>}
                  {it.bedrooms != null && <span className="mr-3">{it.bedrooms} bd</span>}
                  <span>{new Date(it.last_seen).toLocaleString()}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
