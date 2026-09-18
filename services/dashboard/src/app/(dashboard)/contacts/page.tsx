"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { getContacts, getContactStats, exportContactsCsv, refreshPlatforms, bulkTagContacts } from "@/lib/api";
import type { Contact, ContactPlatform } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Skeleton } from "@/components/Skeleton";

const PAGE_SIZE = 50;
const PLATFORMS: ContactPlatform[] = ["telegram", "vkontakte", "whatsapp", "viber"];
const PLATFORM_SHORT: Record<ContactPlatform, string> = { telegram: "TG", vkontakte: "VK", whatsapp: "WA", viber: "Viber" };

function qualityLabel(score: number | null, t: (k: string) => string): { label: string; color: string } {
  if (score == null) return { label: "—", color: "text-zinc-500" };
  if (score >= 70) return { label: t("contacts.high"), color: "text-emerald-400" };
  if (score >= 40) return { label: t("contacts.medium"), color: "text-amber-400" };
  return { label: t("contacts.low"), color: "text-red-400" };
}

export default function ContactsPage() {
  const { auth } = useAuth();
  const { toast } = useToast();
  const { t } = useI18n();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [stats, setStats] = useState<{ total: number; telegram: number; vkontakte: number; whatsapp: number; viber: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [qualityFilter, setQualityFilter] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tagInput, setTagInput] = useState("");
  const [exporting, setExporting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback((p = 0) => {
    if (!auth?.token) return;
    setLoading(true);
    const params: any = { limit: PAGE_SIZE, page: p };
    if (search.trim()) params.search = search.trim();
    if (platformFilter) params.platform = platformFilter;
    if (countryFilter) params.country = countryFilter;
    if (qualityFilter) params.quality = qualityFilter;
    if (selectedTags.length > 0) params.tags = selectedTags.join(",");
    Promise.all([
      getContacts(auth.token, params),
      getContactStats(auth.token).catch(() => null),
    ]).then(([res, s]) => {
      setContacts(res.items || []);
      setTotal(res.total || 0);
      if (s) setStats(s);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [auth?.token, search, platformFilter, countryFilter, qualityFilter, selectedTags]);

  useEffect(() => { setPage(0); load(0); }, [auth?.token, platformFilter, countryFilter, qualityFilter, selectedTags]);
  useEffect(() => {
    const timer = setTimeout(() => { setPage(0); load(0); }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleExport = async () => {
    if (!auth?.token) return;
    setExporting(true);
    try {
      const blob = await exportContactsCsv(auth.token);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `contacts_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click(); URL.revokeObjectURL(url);
    } catch { toast(t("contacts.exportFailed"), "error"); }
    finally { setExporting(false); }
  };

  const handleRefresh = async () => {
    if (!auth?.token || selected.size === 0) return;
    setRefreshing(true);
    try {
      await refreshPlatforms(auth.token, Array.from(selected));
      toast(t("contacts.refreshDone"), "success");
      load(page);
    } catch { toast(t("contacts.refreshFailed"), "error"); }
    finally { setRefreshing(false); }
  };

  const handleBulkTag = async () => {
    if (!auth?.token || selected.size === 0 || !tagInput.trim()) return;
    const tags = tagInput.split(",").map(s => s.trim()).filter(Boolean);
    try {
      await bulkTagContacts(auth.token, Array.from(selected), tags);
      toast(t("contacts.tagsApplied"), "success");
      setSelected(new Set());
      setTagInput("");
      load(page);
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

  const countries = [...new Set(contacts.map(c => c.country).filter(Boolean))] as string[];
  const allTags = [...new Set(contacts.flatMap(c => c.tags))];

  return (
    <div className="space-y-6 animate-fade-slide-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">{t("contacts.title")}</h1>
        <div className="flex gap-2">
          <button onClick={handleRefresh} disabled={refreshing || selected.size === 0}
            className="px-3 py-1.5 bg-zinc-800 text-zinc-300 rounded-lg text-sm hover:bg-zinc-700 disabled:opacity-50 btn-press">
            {refreshing ? "..." : t("contacts.refreshPlatforms")}
          </button>
          <button onClick={handleExport} disabled={exporting}
            className="px-3 py-1.5 bg-zinc-800 text-zinc-300 rounded-lg text-sm hover:bg-zinc-700 disabled:opacity-50 btn-press">
            {exporting ? "..." : t("contacts.exportCsv")}
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label: t("contacts.statTotal"), value: stats?.total ?? "—", color: "text-zinc-100" },
          { label: "TG", value: stats?.telegram ?? "—", color: "text-sky-400" },
          { label: "VK", value: stats?.vkontakte ?? "—", color: "text-blue-400" },
          { label: "WA", value: stats?.whatsapp ?? "—", color: "text-emerald-400" },
          { label: "Viber", value: stats?.viber ?? "—", color: "text-violet-400" },
        ].map((card, i) => (
          <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 card-hover">
            <p className="text-xs text-zinc-500 mb-1">{card.label}</p>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder={t("contacts.search")}
          className="flex-1 min-w-[200px] px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-500" />
        <select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)}
          className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100">
          <option value="">{t("contacts.allPlatforms")}</option>
          {PLATFORMS.map(p => <option key={p} value={p}>{PLATFORM_SHORT[p]}</option>)}
        </select>
        <select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)}
          className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100">
          <option value="">{t("contacts.country")}</option>
          {countries.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={qualityFilter} onChange={(e) => setQualityFilter(e.target.value)}
          className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100">
          <option value="">{t("contacts.quality")}</option>
          <option value="high">{t("contacts.high")}</option>
          <option value="medium">{t("contacts.medium")}</option>
          <option value="low">{t("contacts.low")}</option>
        </select>
        <div className="flex flex-wrap gap-1">
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => {
                setSelectedTags(prev =>
                  prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                );
              }}
              className={`px-2 py-1 text-xs rounded-full transition-colors ${
                selectedTags.includes(tag)
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-white/5 text-white/60 border border-white/10 hover:border-white/20"
              }`}
            >
              {tag}
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
            {t("contacts.bulkTag")}
          </button>
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden md:block bg-zinc-900 border border-zinc-800 rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="px-4 py-3 w-10">
                <input type="checkbox" checked={selected.size === contacts.length && contacts.length > 0} onChange={toggleSelectAll}
                  className="rounded border-zinc-600" />
              </th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">{t("contacts.colPhone")}</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">{t("contacts.colName")}</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">{t("contacts.country")}</th>
              {PLATFORMS.map(p => (
                <th key={p} className="text-center px-2 py-3 text-zinc-400 font-medium">{PLATFORM_SHORT[p]}</th>
              ))}
              <th className="text-left px-4 py-3 text-zinc-400 font-medium hidden lg:table-cell">{t("contacts.lastMessage")}</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium hidden lg:table-cell">{t("contacts.quality")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="px-4 py-8">
                <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="flex gap-4"><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-20" /><Skeleton className="h-4 flex-1" /></div>)}</div>
              </td></tr>
            ) : contacts.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-zinc-500">
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
                  <td className="px-4 py-3 text-zinc-400 text-xs">{c.country || "—"}</td>
                  {PLATFORMS.map(p => (
                    <td key={p} className="px-2 py-3 text-center">
                      {c.platforms?.[p]?.exists
                        ? <span className="text-emerald-400">✓</span>
                        : <span className="text-zinc-600">✗</span>}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-zinc-500 text-xs hidden lg:table-cell">
                    {c.last_mailing ? `${new Date(c.last_mailing.date).toLocaleDateString()} (${c.last_mailing.platform})` : "—"}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className={`text-xs ${qualityLabel(c.quality_score, t).color}`}>
                      {c.quality_score != null ? `${c.quality_score} ${qualityLabel(c.quality_score, t).label}` : "—"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {contacts.length < total && (
          <div className="p-4 text-center">
            <button onClick={() => { const np = page + 1; setPage(np); load(np); }}
              className="px-6 py-2 bg-zinc-800 text-zinc-300 rounded-lg text-sm hover:bg-zinc-700 transition">
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
                  {PLATFORMS.filter(p => c.platforms?.[p]?.exists).map(p => (
                    <span key={p} className="text-emerald-400 text-xs">{PLATFORM_SHORT[p]} ✓</span>
                  ))}
                </div>
              </div>
              <p className="text-xs text-zinc-400">{c.name || "—"} {c.country ? `· ${c.country}` : ""}</p>
              {c.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {c.tags.map((tag, i) => <span key={i} className="px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded text-[10px]">{tag}</span>)}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
