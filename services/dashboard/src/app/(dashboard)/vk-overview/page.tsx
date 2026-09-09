"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { getVkOverview } from "@/lib/api";
import { Skeleton } from "@/components/Skeleton";
import { Crosshair, Radar, Megaphone, Send, TrendingUp, UsersGroup } from "@/components/Icons";

const INTENT_STYLES: Record<string, string> = {
  HOT: "bg-rose-500/10 text-rose-400 border border-rose-500/20",
  WARM: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  COLD: "bg-sky-500/10 text-sky-400 border border-sky-500/20",
  SPAM: "bg-slate-500/10 text-slate-400 border border-slate-500/20",
};

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  warming_up: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  cooldown: "bg-orange-500/10 text-orange-400 border border-orange-500/20",
  banned: "bg-rose-500/10 text-rose-400 border border-rose-500/20",
  paused: "bg-slate-500/10 text-slate-400 border border-slate-500/20",
};

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function VkOverviewPage() {
  const { auth } = useAuth();
  const { t } = useI18n();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    if (!auth?.token) return;
    setLoading(true);
    getVkOverview(auth.token, days)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [auth?.token, days]);

  if (loading) return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-8 w-20" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-7 w-20" />
          </div>
        ))}
      </div>
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );

  if (!data) return <div className="text-zinc-500 text-sm p-8">No data available</div>;

  const { summary, account_health, recent_leads, communities } = data;

  return (
    <div className="space-y-6 max-w-6xl animate-fade-slide-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-100">VK Overview</h1>
        <div className="flex gap-1">
          {[7, 30, 90].map((d) => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                days === d ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
              }`}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Leads", value: summary.total_leads, color: "text-zinc-100" },
          { label: "Hot Leads", value: summary.hot_leads, color: "text-rose-400" },
          { label: "Active Accounts", value: `${summary.active_accounts}/${summary.total_accounts}`, color: "text-emerald-400" },
          { label: "Conversion", value: `${summary.conversion_rate}%`, color: "text-sky-400" },
        ].map((card, i) => (
          <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 card-hover">
            <p className="text-xs text-zinc-500 mb-1">{card.label}</p>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Account Health */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-zinc-100">Account Health</h2>
          <Link href="/accounts" className="text-xs text-zinc-500 hover:text-zinc-300 transition">Manage Accounts →</Link>
        </div>
        {account_health.length === 0 ? (
          <p className="text-sm text-zinc-500">No VK accounts connected yet.</p>
        ) : (
          <div className="space-y-3">
            {account_health.map((acc: any) => {
              const warmupPct = Math.min((acc.warmup_stage / 4) * 100, 100);
              const actionsPct = acc.daily_action_limit > 0 ? (acc.actions_today / acc.daily_action_limit) * 100 : 0;
              return (
                <div key={acc.id} className="bg-zinc-800/50 border border-zinc-800 rounded-lg p-4 card-hover">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`inline-block w-2 h-2 rounded-full ${
                        acc.status === "active" ? "bg-emerald-400" :
                        acc.status === "warming_up" ? "bg-amber-400 status-pulse" :
                        acc.status === "banned" ? "bg-rose-400" : "bg-zinc-500"
                      }`} />
                      <span className="text-sm font-medium text-zinc-100">{acc.group_name}</span>
                      <span className="text-xs text-zinc-500">{acc.members_count?.toLocaleString()} members</span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLES[acc.status] || ""}`}>
                      {acc.status}
                    </span>
                  </div>

                  {/* Warmup Progress */}
                  <div className="mb-2">
                    <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
                      <span>Warmup: Stage {acc.warmup_stage}/4</span>
                      <span>{Math.round(warmupPct)}%</span>
                    </div>
                    <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full transition-all duration-600" style={{ width: `${warmupPct}%` }} />
                    </div>
                  </div>

                  {/* Actions Budget */}
                  <div>
                    <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
                      <span>Actions today: {acc.actions_today}/{acc.daily_action_limit}</span>
                      <span className={actionsPct > 90 ? "text-rose-400" : actionsPct > 70 ? "text-amber-400" : ""}>{Math.round(actionsPct)}%</span>
                    </div>
                    <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-600 ${
                        actionsPct > 90 ? "bg-rose-500" : actionsPct > 70 ? "bg-amber-500" : "bg-emerald-500"
                      }`} style={{ width: `${Math.min(actionsPct, 100)}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Leads */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-zinc-100">Recent VK Leads</h2>
          <Link href="/leads" className="text-xs text-zinc-500 hover:text-zinc-300 transition">View All →</Link>
        </div>
        {recent_leads.length === 0 ? (
          <p className="text-sm text-zinc-500">No VK leads yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-zinc-500 border-b border-zinc-800">
                  <th className="text-left py-2 pr-4">User</th>
                  <th className="text-left py-2 pr-4">Source</th>
                  <th className="text-left py-2 pr-4">Intent</th>
                  <th className="text-left py-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {recent_leads.map((lead: any) => (
                  <tr key={lead.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition">
                    <td className="py-2.5 pr-4 text-zinc-200 font-mono text-xs">{lead.user_handle}</td>
                    <td className="py-2.5 pr-4 text-zinc-400 text-xs">{lead.source || "—"}</td>
                    <td className="py-2.5 pr-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${INTENT_STYLES[lead.intent_score] || ""}`}>
                        {lead.intent_score}
                      </span>
                    </td>
                    <td className="py-2.5 text-zinc-500 text-xs">{timeAgo(lead.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Community Performance */}
      {communities.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-base font-semibold text-zinc-100 mb-4">Community Performance</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-zinc-500 border-b border-zinc-800">
                  <th className="text-left py-2 pr-4">Community</th>
                  <th className="text-left py-2 pr-4">Leads</th>
                  <th className="text-left py-2">Hot</th>
                </tr>
              </thead>
              <tbody>
                {communities.map((c: any, i: number) => (
                  <tr key={i} className="border-b border-zinc-800/50">
                    <td className="py-2.5 pr-4 text-zinc-200">{c.name}</td>
                    <td className="py-2.5 pr-4 text-zinc-300">{c.leads}</td>
                    <td className="py-2.5 text-rose-400">{c.hot}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex gap-3">
        <Link href="/targets" className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 hover:bg-zinc-700 transition btn-press">
          <Radar className="w-4 h-4" /> Group Search
        </Link>
        <Link href="/campaigns" className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 hover:bg-zinc-700 transition btn-press">
          <Megaphone className="w-4 h-4" /> Post to Wall
        </Link>
        <Link href="/mailings" className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 hover:bg-zinc-700 transition btn-press">
          <Send className="w-4 h-4" /> Send DMs
        </Link>
      </div>
    </div>
  );
}
