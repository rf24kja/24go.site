"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { getAnalytics, getLeaderboard } from "@/lib/api";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend,
} from "recharts";
import { Skeleton, CardSkeleton } from "@/components/Skeleton";

const COLORS = {
  rose: "#f43f5e",
  amber: "#f59e0b",
  sky: "#0ea5e9",
  emerald: "#10b981",
  slate: "#94a3b8",
  zinc: "#71717a",
};

export default function AnalyticsPage() {
  const { auth } = useAuth();
  const { t } = useI18n();
  const [data, setData] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth?.token) return;
    setLoading(true);
    Promise.all([
      getAnalytics(auth.token, days),
      getLeaderboard(auth.token, days).catch(() => ({ leaderboard: [] })),
    ]).then(([analytics, lb]) => {
      setData(analytics);
      setLeaderboard(lb.leaderboard || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [auth?.token, days]);

  if (loading) return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <div className="flex gap-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-12 rounded-lg" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-7 w-20" />
          </div>
        ))}
      </div>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <Skeleton className="h-4 w-40 mb-4" />
        <Skeleton className="h-[250px] w-full rounded-lg" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <Skeleton className="h-4 w-36 mb-4" />
            <Skeleton className="h-[250px] w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
  if (!data) return <div className="p-8"><p className="text-zinc-500">{t("analytics.noData")}</p></div>;

  const funnel = data.funnel || {};
  const geoData = (data.geo_breakdown || []).map((g: any) => ({
    name: g.geo_tag,
    leads: g.leads,
    hot: g.hot_leads,
  }));

  const sourceData = (data.source_breakdown || []).map((s: any) => ({
    name: s.source === "dm" ? "💬 DM" : s.source === "comment" ? "💭 Comment" : s.source === "group" ? "👥 Group" : s.source === "manual" ? "✏️ Manual" : s.source,
    leads: s.leads,
    hot: s.hot_leads,
  }));

  const funnelData = [
    { name: t("analytics.targets"), value: funnel.discovered_targets || 0 },
    { name: t("analytics.posts"), value: funnel.published_posts || 0 },
    { name: t("analytics.leads"), value: funnel.leads_captured || 0 },
    { name: t("analytics.hot"), value: funnel.hot_leads || 0 },
  ];

  const intentPie = [
    { name: t("analytics.hot"), value: funnel.hot_leads || 0, color: COLORS.rose },
    { name: t("leads.intent.warm"), value: funnel.warm_leads || 0, color: COLORS.amber },
    { name: t("analytics.noData"), value: Math.max(0, (funnel.leads_captured || 0) - (funnel.hot_leads || 0) - (funnel.warm_leads || 0)), color: COLORS.slate },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("analytics.title")}</h1>
        <div className="flex gap-1">
          {[7, 30, 90].map((d) => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-lg text-sm transition ${days === d ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"}`}>
              {t(`analytics.${d}d`)}
            </button>
          ))}
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label={t("analytics.targets")} value={funnel.discovered_targets || 0} />
        <MetricCard label={t("analytics.postsPublished")} value={funnel.published_posts || 0} />
        <MetricCard label={t("analytics.leadsCaptured")} value={funnel.leads_captured || 0} />
        <MetricCard label={t("analytics.hotLeads")} value={funnel.hot_leads || 0} accent="rose" />
      </div>

      {/* Time Series — posts + leads overlay */}
      {data.time_series && data.time_series.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-sm font-medium text-zinc-400 mb-4">{t("analytics.activityOverTime")}</h2>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={data.time_series}>
              <defs>
                <linearGradient id="leadGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.sky} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={COLORS.sky} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="postGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.emerald} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={COLORS.emerald} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="date" tick={{ fill: "#a1a1aa", fontSize: 11 }} tickFormatter={(v: string) => v.slice(5)} />
              <YAxis tick={{ fill: "#a1a1aa", fontSize: 12 }} />
              <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8 }} />
              <Legend />
              <Area type="monotone" dataKey="leads" name={t("analytics.leads")} stroke={COLORS.sky} fill="url(#leadGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="hot_leads" name={t("analytics.hot")} stroke={COLORS.rose} fill="transparent" strokeWidth={2} strokeDasharray="5 5" />
              <Area type="monotone" dataKey="posts" name={t("analytics.posts")} stroke={COLORS.emerald} fill="url(#postGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conversion Funnel */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-sm font-medium text-zinc-400 mb-4">{t("analytics.conversionFunnel")}</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={funnelData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 12 }} />
              <YAxis tick={{ fill: "#a1a1aa", fontSize: 12 }} />
              <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8 }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {funnelData.map((_: any, i: number) => (
                  <Cell key={i} fill={[COLORS.slate, COLORS.sky, COLORS.amber, COLORS.rose][i]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Intent Distribution */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-sm font-medium text-zinc-400 mb-4">{t("analytics.intentDistribution")}</h2>
          {intentPie.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={intentPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {intentPie.map((entry: any, i: number) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-zinc-500 text-sm text-center py-12">{t("analytics.noLeadData")}</p>
          )}
        </div>

        {/* Source Breakdown */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-sm font-medium text-zinc-400 mb-4">{t("analytics.leadsBySource")}</h2>
          {sourceData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={sourceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 12 }} />
                <YAxis tick={{ fill: "#a1a1aa", fontSize: 12 }} />
                <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8 }} />
                <Legend />
                <Bar dataKey="leads" fill={COLORS.sky} name={t("analytics.totalLeads")} radius={[4, 4, 0, 0]} />
                <Bar dataKey="hot" fill={COLORS.rose} name={t("analytics.hotLeadsLabel")} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-zinc-500 text-sm text-center py-12">{t("analytics.noSourceData")}</p>
          )}
        </div>

        {/* Geo Breakdown */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 lg:col-span-2">
          <h2 className="text-sm font-medium text-zinc-400 mb-4">{t("analytics.geoBreakdown")}</h2>
          {geoData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={geoData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis type="number" tick={{ fill: "#a1a1aa", fontSize: 12 }} />
                <YAxis type="category" dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 12 }} width={100} />
                <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8 }} />
                <Legend />
                <Bar dataKey="leads" fill={COLORS.sky} name={t("analytics.totalLeads")} radius={[0, 4, 4, 0]} />
                <Bar dataKey="hot" fill={COLORS.rose} name={t("analytics.hotLeadsLabel")} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-zinc-500 text-sm text-center py-12">{t("analytics.noGeoData")}</p>
          )}
        </div>
      </div>

      {/* Cost summary */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-sm font-medium text-zinc-400 mb-4">{t("analytics.infraCosts")}</h2>
        <div className="flex gap-8">
          <div>
            <p className="text-2xl font-semibold text-zinc-100">{(data.total_tokens || 0).toLocaleString()}</p>
            <p className="text-zinc-500 text-xs">{t("analytics.llmTokensUsed")}</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-zinc-100">${(data.total_cost_usd || 0).toFixed(4)}</p>
            <p className="text-zinc-500 text-xs">{t("analytics.totalCostUsd")}</p>
          </div>
        </div>
      </div>

      {/* Campaign Leaderboard */}
      {leaderboard.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-sm font-medium text-zinc-400 mb-4">{t("analytics.leaderboard")}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left px-3 py-2 text-zinc-500 font-medium text-xs">#</th>
                  <th className="text-left px-3 py-2 text-zinc-500 font-medium text-xs">{t("analytics.campaign")}</th>
                  <th className="text-left px-3 py-2 text-zinc-500 font-medium text-xs">{t("analytics.colPosts")}</th>
                  <th className="text-left px-3 py-2 text-zinc-500 font-medium text-xs">{t("analytics.colLeads")}</th>
                  <th className="text-left px-3 py-2 text-zinc-500 font-medium text-xs">{t("analytics.colHot")}</th>
                  <th className="text-left px-3 py-2 text-zinc-500 font-medium text-xs">{t("analytics.colWarm")}</th>
                  <th className="text-left px-3 py-2 text-zinc-500 font-medium text-xs">{t("analytics.conversion")}</th>
                  <th className="text-left px-3 py-2 text-zinc-500 font-medium text-xs">{t("analytics.schedule")}</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((c: any, i: number) => (
                  <tr key={c.campaign_id} className="border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/30">
                    <td className="px-3 py-2.5 text-zinc-400">
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : <span className="text-xs">{i + 1}</span>}
                    </td>
                    <td className="px-3 py-2.5 text-zinc-200 font-medium">{c.name}</td>
                    <td className="px-3 py-2.5 text-zinc-400">{c.total_posts}</td>
                    <td className="px-3 py-2.5 text-zinc-200 font-medium">{c.total_leads}</td>
                    <td className="px-3 py-2.5 text-rose-400">{c.hot_leads}</td>
                    <td className="px-3 py-2.5 text-amber-400">{c.warm_leads}</td>
                    <td className="px-3 py-2.5">
                      <span className={`text-xs font-medium ${
                        c.conversion_rate >= 10 ? "text-emerald-400" :
                        c.conversion_rate >= 5 ? "text-amber-400" :
                        "text-zinc-400"
                      }`}>
                        {c.conversion_rate}%
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-zinc-500 text-xs font-mono">{c.schedule_cron || t("analytics.manual")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  const colors: Record<string, string> = {
    rose: "text-rose-400",
    amber: "text-amber-400",
    sky: "text-sky-400",
    emerald: "text-emerald-400",
  };
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <p className="text-zinc-500 text-xs mb-1">{label}</p>
      <p className={`text-2xl font-bold ${colors[accent ?? ""] ?? "text-zinc-100"}`}>{value.toLocaleString()}</p>
    </div>
  );
}
