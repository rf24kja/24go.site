"use client";

import { useState } from "react";
import { Search, Users, Activity, Target, AlertCircle, Loader2 } from "lucide-react";

interface GroupInfo {
  name: string;
  title: string;
  description: string;
  members_count: number;
  is_private: boolean;
  username: string | null;
}

export default function GroupAnalyzer() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GroupInfo | null>(null);
  const [error, setError] = useState("");

  const analyze = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "https://api.24go.site";
      const res = await fetch(`${apiBase}/api/v1/tools/analyze-group`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Failed to analyze group");
        return;
      }
      setResult(data);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getLeadPotential = (members: number) => {
    if (members > 10000) return { label: "Excellent", color: "text-emerald-400", bg: "bg-emerald-500/10" };
    if (members > 1000) return { label: "Good", color: "text-blue-400", bg: "bg-blue-500/10" };
    if (members > 100) return { label: "Fair", color: "text-yellow-400", bg: "bg-yellow-500/10" };
    return { label: "Low", color: "text-zinc-400", bg: "bg-zinc-500/10" };
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-3">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://t.me/joinchat/XXX or @groupname"
          className="flex-1 px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
          onKeyDown={(e) => e.key === "Enter" && analyze()}
        />
        <button
          onClick={analyze}
          disabled={loading || !url.trim()}
          className="px-6 py-3 bg-emerald-500 text-white rounded-xl text-sm font-medium hover:bg-emerald-600 transition disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Analyze
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400" />
          <p className="text-sm text-rose-400">{error}</p>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h3 className="text-lg font-bold mb-2">{result.title || result.name}</h3>
            {result.description && (
              <p className="text-sm text-zinc-400 mb-4">{result.description}</p>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-zinc-800/50 rounded-lg">
                <Users className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                <div className="text-xl font-bold">{result.members_count?.toLocaleString() || "N/A"}</div>
                <div className="text-xs text-zinc-500">Members</div>
              </div>
              <div className="text-center p-3 bg-zinc-800/50 rounded-lg">
                <Activity className="w-5 h-5 text-blue-400 mx-auto mb-1" />
                <div className="text-xl font-bold">{result.is_private ? "Private" : "Public"}</div>
                <div className="text-xs text-zinc-500">Type</div>
              </div>
              <div className="text-center p-3 bg-zinc-800/50 rounded-lg">
                <Target className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
                <div className={`text-xl font-bold ${getLeadPotential(result.members_count || 0).color}`}>
                  {getLeadPotential(result.members_count || 0).label}
                </div>
                <div className="text-xs text-zinc-500">Lead Potential</div>
              </div>
              <div className="text-center p-3 bg-zinc-800/50 rounded-lg">
                <div className="text-xl font-bold text-purple-400">
                  {result.members_count ? Math.round(result.members_count * 0.02).toLocaleString() : "N/A"}
                </div>
                <div className="text-xs text-zinc-500">Est. Leads (2%)</div>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-sm text-zinc-400">
              <strong className="text-zinc-200">Want to scrape all members?</strong>{" "}
              24GO can automatically extract leads from this group with contact info,
              activity level, and intent scoring.{" "}
              <a href="/login" className="text-emerald-400 hover:underline">
                Start free trial →
              </a>
            </p>
          </div>
        </div>
      )}

      {!result && !error && (
        <div className="text-center py-12 text-zinc-500">
          <Search className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>Enter a Telegram group link above to analyze</p>
        </div>
      )}
    </div>
  );
}
