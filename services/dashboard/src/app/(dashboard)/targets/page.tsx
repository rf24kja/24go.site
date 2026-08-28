"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getTargets, dispatchParser, scrapeTargetComments } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Skeleton } from "@/components/Skeleton";

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
    getTargets(auth.token).then((res) => setTargets(res.items || res)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [auth?.token]);

  const handleScan = async () => {
    if (!auth?.token) return;
    setScanning(true);
    try {
      await dispatchParser(auth.token, {
        platforms: ["telegram"],
        target_geos: scanGeo.split(",").map((s) => s.trim()),
        niches: scanNiche.split(",").map((s) => s.trim()),
        max_results_per_niche: 20,
      });
      toast("Scan dispatched", "success");
      setTimeout(load, 3000);
    } catch (e: any) {
      toast(e.message || "Scan failed", "error");
    } finally {
      setScanning(false);
    }
  };

  const handleScrape = async () => {
    if (!auth?.token || !scrapeModal || !scrapePostId.trim()) return;
    setScraping(true);
    try {
      await scrapeTargetComments(auth.token, scrapeModal, scrapePostId.trim());
      toast("Comment scrape started", "success");
      setScrapeModal(null);
      setScrapePostId("");
    } catch (e: any) {
      toast(e.message || "Scrape failed", "error");
    } finally {
      setScraping(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Target Discovery</h1>
      </div>

      {/* How targets work */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h2 className="text-sm font-medium text-zinc-300 mb-2">How targets work</h2>
        <p className="text-xs text-zinc-500">
          Targets are Telegram groups and channels where your audience hangs out.
          Scan by <strong className="text-zinc-400">GEO</strong> (city/country) and <strong className="text-zinc-400">niche</strong> to discover them.
          Once found, connect an account and start a listener to intercept DMs, or post campaigns and scrape comments.
        </p>
      </div>

      {/* Scan controls */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h2 className="text-sm font-medium text-zinc-400 mb-3">Discover New Targets</h2>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-xs text-zinc-500 mb-1 block">GEOs (comma-separated)</label>
            <input type="text" value={scanGeo} onChange={(e) => setScanGeo(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100" />
          </div>
          <div className="flex-1">
            <label className="text-xs text-zinc-500 mb-1 block">Niches (comma-separated)</label>
            <input type="text" value={scanNiche} onChange={(e) => setScanNiche(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100" />
          </div>
          <button onClick={handleScan} disabled={scanning}
            className="px-5 py-2 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-200 disabled:opacity-50 whitespace-nowrap">
            {scanning ? "Scanning..." : "🔍 Scan"}
          </button>
        </div>
      </div>

      {/* Targets table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[1000px]">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Platform</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Title</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">GEO</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Niche</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Access</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Members</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Last Parsed</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Status</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="px-4 py-8">
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              </td></tr>
            ) : targets.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-zinc-500">
                <p className="text-zinc-300 font-medium mb-2">No targets discovered yet</p>
                <p className="text-xs text-zinc-500 mb-1">Use the scan above to find Telegram groups and channels in your GEO and niche.</p>
                <p className="text-xs text-zinc-600">Example: GEO = &quot;Moscow&quot;, Niche = &quot;thailand_travel&quot;</p>
              </td></tr>
            ) : (
              targets.map((t) => (
                <tr key={t.id} className="border-b border-zinc-800 last:border-0 hover:bg-zinc-800/30">
                  <td className="px-4 py-3">{PLATFORM_ICONS[t.platform] ?? "❓"} {t.platform}</td>
                  <td className="px-4 py-3 text-zinc-100 truncate max-w-[200px]">{t.title}</td>
                  <td className="px-4 py-3 text-zinc-400">{t.geo_tag}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded text-xs">{t.niche}</span>
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-xs">{t.access}</td>
                  <td className="px-4 py-3 text-zinc-400">{(t.members_count || 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-zinc-400 text-xs">
                    {t.last_parsed_at
                      ? new Date(t.last_parsed_at).toLocaleString()
                      : <span className="text-zinc-600">never</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${t.is_active ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"}`}>
                      {t.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => setScrapeModal(t.id)}
                      className="px-2.5 py-1 text-xs bg-zinc-800 text-zinc-300 border border-zinc-700 rounded hover:bg-zinc-700 transition">
                      💭 Scrape Comments
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
            <h2 className="text-lg font-bold text-zinc-100">Scrape Comments</h2>
            <p className="text-xs text-zinc-500">Enter the Telegram post message ID to scrape comments from.</p>
            <input type="text" placeholder="Message ID (e.g. 12345)" value={scrapePostId}
              onChange={(e) => setScrapePostId(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 font-mono" />
            <p className="text-[10px] text-zinc-600">Find the message ID from the post URL: t.me/channel/<strong>12345</strong></p>
            <div className="flex gap-3">
              <button onClick={handleScrape} disabled={scraping || !scrapePostId.trim()}
                className="flex-1 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {scraping ? "Scraping..." : "Start Scraping"}
              </button>
              <button onClick={() => setScrapeModal(null)}
                className="flex-1 py-2 bg-zinc-800 text-zinc-400 rounded-lg text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
