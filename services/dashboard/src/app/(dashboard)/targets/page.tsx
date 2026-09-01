"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getTargets, discoverGroups, scrapeTargetComments } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Skeleton } from "@/components/Skeleton";
import { useI18n } from "@/lib/i18n";
import { FieldHint } from "@/components/FieldHint";

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

const PLATFORM_ICONS: Record<string, string> = {
  telegram: "✈️",
  vkontakte: "🔵",
  forum: "💬",
};

export default function TargetsPage() {
  const { auth } = useAuth();
  const { toast } = useToast();
  const { t } = useI18n();
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanGeo, setScanGeo] = useState("Moscow");
  const [scanNiche, setScanNiche] = useState("thailand_travel");
  const [scrapeModal, setScrapeModal] = useState<string | null>(null); // target_id
  const [scrapePostId, setScrapePostId] = useState("");
  const [scraping, setScraping] = useState(false);

  const load = () => {
    if (!auth?.token) return;
    setLoading(true);
    getTargets(auth.token).then((res) => setTargets(res.items || res)).catch(() => setTargets([])).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [auth?.token]);

  const handleScan = async () => {
    if (!auth?.token) return;
    setScanning(true);
    try {
      const geo = scanGeo.split(",").map((s) => s.trim()).filter(Boolean)[0] || "global";
      const niche = scanNiche.split(",").map((s) => s.trim()).filter(Boolean)[0] || "general";
      const res = await discoverGroups(auth.token, { geo_tag: geo, niche, platform: "telegram" });
      if (res.total > 0) {
        toast(t("targets.found").replace("{total}", String(res.total)), "success");
      } else {
        toast(t("targets.noneFound"), "info");
      }
      load();
    } catch (e: any) {
      toast(e.message || t("targets.scanFailed"), "error");
    } finally {
      setScanning(false);
    }
  };

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
    <div className={`space-y-6 animate-fade-slide-in`}>
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

      {/* Scan controls */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h2 className="text-sm font-medium text-zinc-400 mb-3">{t("targets.discoverNew")}</h2>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-xs text-zinc-500 mb-1 block">{t("targets.geosLabel")} <FieldHint hint={t("targets.hint.geos")} /></label>
            <input type="text" value={scanGeo} onChange={(e) => setScanGeo(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100" />
          </div>
          <div className="flex-1">
            <label className="text-xs text-zinc-500 mb-1 block">{t("targets.nichesLabel")} <FieldHint hint={t("targets.hint.niches")} /></label>
            <input type="text" value={scanNiche} onChange={(e) => setScanNiche(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100" />
          </div>
          <button onClick={handleScan} disabled={scanning}
            className="px-5 py-2 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-200 disabled:opacity-50 whitespace-nowrap btn-press">
            {scanning ? t("targets.scanning") : t("targets.scan")}
          </button>
        </div>
      </div>

      {/* Targets table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[1000px]">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">{t("targets.colPlatform")}</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">{t("targets.colTitle")}</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">{t("targets.colGeo")}</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">{t("targets.colNiche")}</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">{t("targets.colAccess")}</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">{t("targets.colMembers")}</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">{t("targets.colLastParsed")}</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">{t("targets.colStatus")}</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">{t("targets.colActions")}</th>
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
                  <td className="px-4 py-3">{PLATFORM_ICONS[target.platform] ?? "❓"} {target.platform}</td>
                  <td className="px-4 py-3 text-zinc-100 truncate max-w-[200px]">{target.title}</td>
                  <td className="px-4 py-3 text-zinc-400">{target.geo_tag}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded text-xs">{target.niche}</span>
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-xs">{target.access}</td>
                  <td className="px-4 py-3 text-zinc-400">{(target.members_count || 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-zinc-400 text-xs">
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
