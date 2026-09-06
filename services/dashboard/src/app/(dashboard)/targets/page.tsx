"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getTargets, discoverGroups, scrapeTargetComments, searchGroupsTgstat } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Skeleton } from "@/components/Skeleton";
import { useI18n } from "@/lib/i18n";
import { FieldHint } from "@/components/FieldHint";
import { Search, Telegram, Vk } from "@/components/Icons";

type Target = {
  id: string;
  platform: string;
  target_id_code: string;
  title: string;
  geo_tag: string;
  niche: string;
  access: string;
  members_count: number;
  engagement_rate: number;
  is_active: boolean;
  last_parsed_at: string | null;
  created_at: string;
};

type SearchMode = "free" | "tgstat";

const COUNTRIES = [
  { value: "ru", label: "Россия" },
  { value: "all", label: "All" },
  { value: "th", label: "Thailand" },
  { value: "kz", label: "Kazakhstan" },
  { value: "uz", label: "Uzbekistan" },
  { value: "by", label: "Belarus" },
  { value: "ua", label: "Ukraine" },
  { value: "tr", label: "Turkey" },
];

const LANGUAGES = [
  { value: "ru", label: "Русский" },
  { value: "en", label: "English" },
  { value: "th", label: "Thai" },
  { value: "uk", label: "Українська" },
  { value: "kk", label: "Қазақ" },
];

const CATEGORIES = [
  { value: "", label: "All" },
  { value: "business", label: "Business" },
  { value: "finance", label: "Finance" },
  { value: "realestate", label: "Real Estate" },
  { value: "marketing", label: "Marketing" },
  { value: "it", label: "IT" },
  { value: "education", label: "Education" },
  { value: "travel", label: "Travel" },
  { value: "shopping", label: "Shopping" },
  { value: "entertainment", label: "Entertainment" },
  { value: "news", label: "News" },
  { value: "sports", label: "Sports" },
];

function PlatformIcon({ platform }: { platform: string }) {
  if (platform === "telegram") return <Telegram className="w-4 h-4 text-blue-400" />;
  if (platform === "vkontakte") return <Vk className="w-4 h-4 text-blue-500" />;
  return <span className="text-zinc-500 text-xs">❓</span>;
}

export default function TargetsPage() {
  const { auth } = useAuth();
  const { toast } = useToast();
  const { t } = useI18n();
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchMode, setSearchMode] = useState<SearchMode>("free");
  const [scanning, setScanning] = useState(false);

  const [scanGeo, setScanGeo] = useState("Moscow");
  const [scanNiche, setScanNiche] = useState("thailand_travel");

  const [tgstatQuery, setTgstatQuery] = useState("");
  const [tgstatCountry, setTgstatCountry] = useState("ru");
  const [tgstatLanguage, setTgstatLanguage] = useState("ru");
  const [tgstatCategory, setTgstatCategory] = useState("");
  const [tgstatBalance, setTgstatBalance] = useState<number | null>(null);

  const [scrapeModal, setScrapeModal] = useState<string | null>(null);
  const [scrapePostId, setScrapePostId] = useState("");
  const [scraping, setScraping] = useState(false);

  const [tgstatResults, setTgstatResults] = useState<any[]>([]);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  const load = () => {
    if (!auth?.token) return;
    setLoading(true);
    getTargets(auth.token).then((res) => setTargets(res.items || res)).catch(() => setTargets([])).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [auth?.token]);

  const handleFreeSearch = async () => {
    if (!auth?.token) return;
    setScanning(true);
    try {
      const geo = scanGeo.split(",").map((s) => s.trim()).filter(Boolean)[0] || "global";
      const niche = scanNiche.split(",").map((s) => s.trim()).filter(Boolean)[0] || "general";
      const res = await discoverGroups(auth.token, { geo_tag: geo, niche, platform: "telegram" });
      if (res.total > 0) {
        toast(t("targets.found").replace("{total}", String(res.total)), "success");
      } else {
        toast(t("targets.freeSearchNoAccounts"), "info");
      }
      load();
    } catch (e: any) {
      toast(e.message || t("targets.scanFailed"), "error");
    } finally {
      setScanning(false);
    }
  };

  const handleTgstatSearch = async () => {
    if (!auth?.token || !tgstatQuery.trim()) return;
    setScanning(true);
    setTgstatResults([]);
    try {
      const res = await searchGroupsTgstat(auth.token, {
        query: tgstatQuery.trim(),
        country: tgstatCountry,
        language: tgstatLanguage,
        category: tgstatCategory || undefined,
        limit: 20,
      });
      setTgstatResults(res.results || []);
      setTgstatBalance(res.balance ?? null);
      if ((res.results || []).length > 0) {
        toast(`Found ${res.results.length} channels`, "success");
      } else {
        toast(t("targets.noneFound"), "info");
      }
    } catch (e: any) {
      toast(e.message || t("targets.scanFailed"), "error");
    } finally {
      setScanning(false);
    }
  };

  const handleAddTarget = async (result: any) => {
    if (!auth?.token) return;
    try {
      await discoverGroups(auth.token, {
        geo_tag: tgstatCountry,
        niche: tgstatQuery.trim(),
        platform: "telegram",
      });
      setAddedIds((prev) => new Set(prev).add(result.username));
      toast(t("targets.added"), "success");
      load();
    } catch (e: any) {
      toast(e.message || "Failed to add", "error");
    }
  };

  const handleScan = searchMode === "free" ? handleFreeSearch : handleTgstatSearch;

  const handleScrape = async () => {
    if (!auth?.token || !scrapeModal || !scrapePostId.trim()) return;
    setScraping(true);
    try {
      await scrapeTargetComments(auth.token, scrapeModal, scrapePostId.trim());
      toast(t("targets.scrapeStarted"), "success");
      setScrapeModal(null);
      setScrapePostId("");
    } catch (e: any) {
      toast(e.message || t("targets.scrapeFailed"), "error");
    } finally {
      setScraping(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-slide-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("targets.title")}</h1>
      </div>

      {/* How targets work */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h2 className="text-sm font-medium text-zinc-300 mb-2">{t("targets.howItWorks")}</h2>
        <p className="text-xs text-zinc-500">
          {t("targets.howDesc")}{" "}
          {t("targets.howScan")}{" "}
          {t("targets.howAction")}
        </p>
      </div>

      {/* Search mode toggle + form */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <div className="flex items-center gap-4 mb-4">
          <h2 className="text-sm font-medium text-zinc-400">{t("targets.discoverNew")}</h2>
          <div className="flex items-center bg-zinc-800 rounded-lg p-0.5 border border-zinc-700">
            <button
              onClick={() => setSearchMode("free")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                searchMode === "free"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {t("targets.modeFree")}
            </button>
            <button
              onClick={() => setSearchMode("tgstat")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                searchMode === "tgstat"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              TgStat
            </button>
          </div>
          <span className="text-[10px] text-zinc-600">
            {searchMode === "free" ? t("targets.freeDesc") : t("targets.tgstatDesc")}
          </span>
          {searchMode === "tgstat" && tgstatBalance !== null && (
            <span className="text-[10px] text-zinc-500 ml-auto">
              {t("targets.tgstatBalance")}: {tgstatBalance.toLocaleString()} ₽
            </span>
          )}
        </div>

        {searchMode === "free" ? (
          <div className="flex flex-col md:flex-row gap-3 items-end">
            <div className="flex-1 w-full">
              <label className="text-xs text-zinc-500 mb-1 block">{t("targets.geosLabel")} <FieldHint hint={t("targets.hint.geos")} /></label>
              <input type="text" value={scanGeo} onChange={(e) => setScanGeo(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none transition" />
            </div>
            <div className="flex-1 w-full">
              <label className="text-xs text-zinc-500 mb-1 block">{t("targets.nichesLabel")} <FieldHint hint={t("targets.hint.niches")} /></label>
              <input type="text" value={scanNiche} onChange={(e) => setScanNiche(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none transition" />
            </div>
            <button onClick={handleScan} disabled={scanning}
              className="flex items-center gap-2 px-5 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-400 disabled:opacity-50 whitespace-nowrap btn-press transition">
              <Search className="w-4 h-4" />
              {scanning ? t("targets.scanning") : t("targets.scan")}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-col md:flex-row gap-3 items-end">
              <div className="flex-[2] w-full">
                <label className="text-xs text-zinc-500 mb-1 block">{t("targets.keywordLabel")}</label>
                <input type="text" value={tgstatQuery} onChange={(e) => setTgstatQuery(e.target.value)}
                  placeholder="недвижимость Москва"
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none transition" />
              </div>
              <div className="flex-1 w-full">
                <label className="text-xs text-zinc-500 mb-1 block">{t("targets.countryLabel")}</label>
                <select value={tgstatCountry} onChange={(e) => setTgstatCountry(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none transition">
                  {COUNTRIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className="flex-1 w-full">
                <label className="text-xs text-zinc-500 mb-1 block">{t("targets.languageLabel")}</label>
                <select value={tgstatLanguage} onChange={(e) => setTgstatLanguage(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none transition">
                  {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
              <div className="flex-1 w-full">
                <label className="text-xs text-zinc-500 mb-1 block">{t("targets.categoryLabel")}</label>
                <select value={tgstatCategory} onChange={(e) => setTgstatCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none transition">
                  {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <button onClick={handleScan} disabled={scanning || !tgstatQuery.trim()}
                className="flex items-center gap-2 px-5 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-400 disabled:opacity-50 whitespace-nowrap btn-press transition">
                <Search className="w-4 h-4" />
                {scanning ? t("targets.searching") : t("targets.find")}
              </button>
            </div>
            <p className="text-[10px] text-zinc-600">{t("targets.tgstatCost")}</p>
          </div>
        )}
      </div>

      {/* TgStat results (when in tgstat mode and have results) */}
      {searchMode === "tgstat" && tgstatResults.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Channel</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium hidden md:table-cell">Subscribers</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium hidden md:table-cell">ER</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium hidden md:table-cell">Country</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tgstatResults.map((r, i) => (
                <tr key={r.username || i} className="border-b border-zinc-800 last:border-0 hover:bg-zinc-800/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Telegram className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      <div>
                        <p className="text-zinc-100 text-sm font-medium">{r.title || r.username}</p>
                        <p className="text-zinc-500 text-xs">@{r.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-400 hidden md:table-cell">
                    {(r.members_count || 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {r.engagement_rate != null ? (
                      <span className="text-emerald-400 text-xs">{(r.engagement_rate * 100).toFixed(1)}%</span>
                    ) : (
                      <span className="text-zinc-600 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-xs hidden md:table-cell">{r.country || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {addedIds.has(r.username) ? (
                        <span className="px-2.5 py-1 text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
                          {t("targets.added")}
                        </span>
                      ) : (
                        <button onClick={() => handleAddTarget(r)}
                          className="px-2.5 py-1 text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded hover:bg-emerald-500/20 transition">
                          {t("targets.addToList")}
                        </button>
                      )}
                      {r.username && (
                        <a href={`https://t.me/${r.username}`} target="_blank" rel="noopener noreferrer"
                          className="px-2.5 py-1 text-xs bg-zinc-800 text-zinc-400 border border-zinc-700 rounded hover:bg-zinc-700 transition">
                          {t("targets.viewOnTgstat")}
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Targets table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">{t("targets.colPlatform")} <FieldHint hint={t("hints.targets.platform")} /></th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">{t("targets.colTitle")} <FieldHint hint={t("hints.targets.title")} /></th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium hidden md:table-cell">{t("targets.colGeo")} <FieldHint hint={t("hints.targets.geo")} /></th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium hidden md:table-cell">{t("targets.colNiche")} <FieldHint hint={t("hints.targets.niche")} /></th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium hidden md:table-cell">{t("targets.colAccess")} <FieldHint hint={t("hints.targets.access")} /></th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">{t("targets.colMembers")} <FieldHint hint={t("hints.targets.members")} /></th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium hidden md:table-cell">{t("targets.colLastParsed")} <FieldHint hint={t("hints.targets.lastParsed")} /></th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">{t("targets.colStatus")} <FieldHint hint={t("hints.targets.status")} /></th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">{t("targets.colActions")} <FieldHint hint={t("hints.targets.actions")} /></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="px-4 py-8">
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex gap-4">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 flex-1" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-14" />
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-14" />
                      <Skeleton className="h-4 w-28" />
                    </div>
                  ))}
                </div>
              </td></tr>
            ) : targets.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-zinc-500">
                <p className="text-zinc-300 font-medium mb-2">{t("targets.empty")}</p>
                <p className="text-xs text-zinc-500 mb-1">{t("targets.emptyDesc")}</p>
                <p className="text-xs text-zinc-600">{t("targets.emptyHint")}</p>
              </td></tr>
            ) : (
              targets.map((target) => (
                <tr key={target.id} className="border-b border-zinc-800 last:border-0 hover:bg-zinc-800/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <PlatformIcon platform={target.platform} />
                      <span className="text-zinc-400 text-xs">{target.platform}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-100 truncate max-w-[200px]">{target.title}</td>
                  <td className="px-4 py-3 text-zinc-400 hidden md:table-cell">{target.geo_tag}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded text-xs">{target.niche}</span>
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-xs hidden md:table-cell">{target.access}</td>
                  <td className="px-4 py-3 text-zinc-400">{(target.members_count || 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-zinc-400 text-xs hidden md:table-cell">
                    {target.last_parsed_at
                      ? new Date(target.last_parsed_at).toLocaleString()
                      : <span className="text-zinc-600">{t("targets.never")}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${target.is_active ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"}`}>
                      {target.is_active ? t("targets.active") : t("targets.inactive")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => setScrapeModal(target.id)}
                      className="px-2.5 py-1 text-xs bg-zinc-800 text-zinc-300 border border-zinc-700 rounded hover:bg-zinc-700 transition">
                      {t("targets.scrapeComments")}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Scrape Comments Modal */}
      {scrapeModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setScrapeModal(null)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-zinc-100">{t("targets.scrapeTitle")}</h2>
            <p className="text-xs text-zinc-500">{t("targets.scrapeDesc")}</p>
            <input type="text" placeholder={t("targets.scrapePlaceholder")} value={scrapePostId}
              onChange={(e) => setScrapePostId(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 font-mono" />
            <p className="text-[10px] text-zinc-600">{t("targets.scrapeHint")}</p>
            <div className="flex gap-3">
              <button onClick={handleScrape} disabled={scraping || !scrapePostId.trim()}
                className="flex-1 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {scraping ? t("targets.scraping") : t("targets.startScraping")}
              </button>
              <button onClick={() => setScrapeModal(null)}
                className="flex-1 py-2 bg-zinc-800 text-zinc-400 rounded-lg text-sm">{t("targets.cancel")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
