"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getTargets, dispatchParser } from "@/lib/api";

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
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanGeo, setScanGeo] = useState("Moscow");
  const [scanNiche, setScanNiche] = useState("thailand_travel");

  const load = () => {
    if (!auth?.token) return;
    setLoading(true);
    getTargets(auth.token).then(setTargets).finally(() => setLoading(false));
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
      // Reload after a delay (parser needs time)
      setTimeout(load, 3000);
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Target Discovery</h1>
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
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Platform</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Title</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">GEO</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Niche</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Access</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Members</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Engagement</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-zinc-500">Loading...</td></tr>
            ) : targets.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-zinc-500">No targets discovered yet. Run a scan above.</td></tr>
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
                  <td className="px-4 py-3 text-zinc-400">{t.engagement_rate}%</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${t.is_active ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"}`}>
                      {t.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
