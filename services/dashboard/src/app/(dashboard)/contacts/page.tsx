"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { getContacts, getContactStats, exportContactsCsv, checkTgPhones, bulkTagContacts } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Skeleton } from "@/components/Skeleton";

type Contact = {
  id: string;
  phone: string;
  name: string | null;
  metadata_: {
    has_tg?: boolean;
    has_viber?: boolean;
    tags?: string[];
    last_mailing?: string;
    source?: string;
  } | null;
  created_at: string;
};

const PAGE_SIZE = 50;

export default function ContactsPage() {
  const { auth } = useAuth();
  const { toast } = useToast();
  const { t } = useI18n();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [stats, setStats] = useState<{ total: number; with_tg: number; with_viber: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [tgFilter, setTgFilter] = useState<"all" | "yes" | "no">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tagInput, setTagInput] = useState("");
  const [exporting, setExporting] = useState(false);
  const [checkingTg, setCheckingTg] = useState(false);

  const load = (offset = 0) => {
    if (!auth?.token) return;
    setLoading(true);
    const params: any = { limit: PAGE_SIZE, offset };
    if (search.trim()) params.search = search.trim();
    if (tgFilter === "yes") params.has_tg = true;
    else if (tgFilter === "no") params.has_tg = false;
    Promise.all([
      getContacts(auth.token, params),
      getContactStats(auth.token).catch(() => null),
    ]).then(([res, s]) => {
      setContacts(res.items || []);
      setTotal(res.total || 0);
      if (s) setStats(s);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { setPage(0); load(0); }, [auth?.token, tgFilter]);
  useEffect(() => {
    const timer = setTimeout(() => { setPage(0); load(0); }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    load(nextPage * PAGE_SIZE);
  };

  const handleExport = async () => {
    if (!auth?.token) return;
    setExporting(true);
    try {
      const blob = await exportContactsCsv(auth.token);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `contacts_${new Date().toISOString().slice(0,10)}.csv`;
      a.click(); URL.revokeObjectURL(url);
    } catch { toast(t("contacts.exportFailed"), "error"); }
    finally { setExporting(false); }
  };

  const handleCheckTg = async () => {
    if (!auth?.token) return;
    setCheckingTg(true);
    try {
      const phones = contacts.map(c => c.phone);
      await checkTgPhones(auth.token, phones);
      toast(t("contacts.checkTgDispatched"), "success");
    } catch { toast(t("contacts.checkTgFailed"), "error"); }
    finally { setCheckingTg(false); }
  };

  const handleBulkTag = async () => {
    if (!auth?.token || selected.size === 0 || !tagInput.trim()) return;
    const tags = tagInput.split(",").map(t => t.trim()).filter(Boolean);
    try {
      await bulkTagContacts(auth.token, Array.from(selected), tags);
      toast(t("contacts.tagsApplied"), "success");
      setSelected(new Set());
      setTagInput("");
      load(page * PAGE_SIZE);
    } catch { toast(t("contacts.tagsFailed"), "error"); }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === contacts.length) setSelected(new Set());
    else setSelected(new Set(contacts.map(c => c.id)));
  };

  return (
    <div className="space-y-6 animate-fade-slide-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">{t("contacts.title")}</h1>
        <div className="flex gap-2">
          <button onClick={handleCheckTg} disabled={checkingTg || contacts.length === 0}
            className="px-3 py-1.5 bg-zinc-800 text-zinc-300 rounded-lg text-sm hover:bg-zinc-700 disabled:opacity-50 btn-press">
            {checkingTg ? "..." : t("contacts.checkTg")}
          </button>
          <button onClick={handleExport} disabled={exporting}
            className="px-3 py-1.5 bg-zinc-800 text-zinc-300 rounded-lg text-sm hover:bg-zinc-700 disabled:opacity-50 btn-press">
            {exporting ? "..." : t("contacts.exportCsv")}
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: t("contacts.statTotal"), value: stats?.total ?? "—", color: "text-zinc-100" },
          { label: t("contacts.statTg"), value: stats?.with_tg ?? "—", color: "text-sky-400" },
          { label: t("contacts.statViber"), value: stats?.with_viber ?? "—", color: "text-violet-400" },
        ].map((card, i) => (
          <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 card-hover">
            <p className="text-xs text-zinc-500 mb-1">{card.label}</p>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder={t("contacts.searchPlaceholder")}
          className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-500" />
        <div className="flex gap-1">
          {(["all", "yes", "no"] as const).map((v) => (
            <button key={v} onClick={() => setTgFilter(v)}
              className={`px-3 py-1.5 rounded-lg text-xs transition ${tgFilter === v ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"}`}>
              {t(`contacts.tgFilter.${v}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl p-3">
          <span className="text-xs text-zinc-400">{t("contacts.selected").replace("{count}", String(selected.size))}</span>
          <input type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)}
            placeholder={t("contacts.tagInputPlaceholder")}
            className="flex-1 max-w-xs px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-100" />
          <button onClick={handleBulkTag} disabled={!tagInput.trim()}
            className="px-3 py-1.5 bg-zinc-100 text-zinc-900 rounded-lg text-xs font-medium disabled:opacity-50 btn-press">
            {t("contacts.applyTags")}
          </button>
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden md:block bg-zinc-900 border border-zinc-800 rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="px-4 py-3 w-10">
                <input type="checkbox" checked={selected.size === contacts.length && contacts.length > 0} onChange={toggleSelectAll}
                  className="rounded border-zinc-600" />
              </th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">{t("contacts.colPhone")}</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">{t("contacts.colName")}</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">{t("contacts.colSource")}</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">{t("contacts.colTg")}</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">{t("contacts.colViber")}</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium hidden lg:table-cell">{t("contacts.colLastMailing")}</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium hidden lg:table-cell">{t("contacts.colTags")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8">
                <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="flex gap-4"><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-20" /><Skeleton className="h-4 flex-1" /></div>)}</div>
              </td></tr>
            ) : contacts.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-zinc-500">
                <p className="text-zinc-300 font-medium mb-1">{t("contacts.empty")}</p>
                <p className="text-xs text-zinc-500">{t("contacts.emptyDesc")}</p>
              </td></tr>
            ) : (
              contacts.map((c) => (
                <tr key={c.id} className="border-b border-zinc-800 last:border-0 hover:bg-zinc-800/30">
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} className="rounded border-zinc-600" />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-200">{c.phone}</td>
                  <td className="px-4 py-3 text-zinc-300">{c.name || "—"}</td>
                  <td className="px-4 py-3 text-zinc-400 text-xs">{c.metadata_?.source || "—"}</td>
                  <td className="px-4 py-3">{c.metadata_?.has_tg ? <span className="text-emerald-400">✓</span> : <span className="text-zinc-600">✗</span>}</td>
                  <td className="px-4 py-3">{c.metadata_?.has_viber ? <span className="text-violet-400">✓</span> : <span className="text-zinc-600">✗</span>}</td>
                  <td className="px-4 py-3 text-zinc-500 text-xs hidden lg:table-cell">{c.metadata_?.last_mailing ? new Date(c.metadata_.last_mailing).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {(c.metadata_?.tags || []).slice(0, 3).map((tag, i) => (
                        <span key={i} className="px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded text-[10px]">{tag}</span>
                      ))}
                      {(c.metadata_?.tags || []).length > 3 && <span className="text-[10px] text-zinc-600">+{(c.metadata_?.tags || []).length - 3}</span>}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {contacts.length < total && (
          <div className="p-4 text-center">
            <button onClick={loadMore} className="px-6 py-2 bg-zinc-800 text-zinc-300 rounded-lg text-sm hover:bg-zinc-700 transition">
              {t("contacts.loadMore").replace("{loaded}", String(contacts.length)).replace("{total}", String(total))}
            </button>
          </div>
        )}
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-20" /></div>)
        ) : contacts.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center text-zinc-500">{t("contacts.empty")}</div>
        ) : (
          contacts.map((c) => (
            <div key={c.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm text-zinc-200">{c.phone}</span>
                <div className="flex items-center gap-2">
                  {c.metadata_?.has_tg && <span className="text-emerald-400 text-xs">TG ✓</span>}
                  {c.metadata_?.has_viber && <span className="text-violet-400 text-xs">V ✓</span>}
                </div>
              </div>
              <p className="text-xs text-zinc-400">{c.name || "—"}</p>
              {c.metadata_?.tags && c.metadata_.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {c.metadata_.tags.map((tag, i) => <span key={i} className="px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded text-[10px]">{tag}</span>)}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
