"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Skeleton } from "@/components/Skeleton";
import { ChartBar, Radio, UsersGroup, UserCircle, Send, CheckCircle, Eye, MessageSquare, Megaphone } from "@/components/Icons";

export default function WaOverviewPage() {
  const { auth } = useAuth();
  const { t } = useI18n();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth?.token) return;
    setLoading(true);
    import("@/lib/api").then(m =>
      Promise.all([
        m.getWaAccounts(auth.token!).catch(() => ({ items: [] })),
        m.getWaGroups(auth.token!).catch(() => ({ items: [] })),
        m.getContacts(auth.token!, { limit: 0 }).catch(() => ({ total: 0, items: [] })),
        m.getCampaigns(auth.token!, { platform: "whatsapp", limit: 20 }).catch(() => ({ items: [] })),
      ]).then(([accounts, groups, contacts, campaigns]) => {
        const accts = accounts.items || accounts;
        const campaignItems = campaigns.items || campaigns;
        let sentToday = 0, delivered = 0, read = 0, responses = 0;
        const history: any[] = [];
        for (const c of campaignItems) {
          const stats = c.stats || {};
          sentToday += stats.sent_today || stats.sent || 0;
          delivered += stats.delivered || 0;
          read += stats.read || 0;
          responses += stats.responses || stats.replies || 0;
          if (stats.sent || stats.delivered) {
            history.push({
              date: c.created_at || c.updated_at || "",
              campaign: c.name || "—",
              platform: "WhatsApp",
              recipients: stats.recipients || stats.sent || 0,
              delivered: stats.delivered || 0,
              read: stats.read || 0,
              responses: stats.responses || stats.replies || 0,
            });
          }
        }
        const contactsList = contacts.items || [];
        const qualityBuckets: Record<string, number> = {};
        for (const c of contactsList) {
          const q = String(c.quality_score || "unknown");
          qualityBuckets[q] = (qualityBuckets[q] || 0) + 1;
        }
        setData({
          connected_accounts: accts.filter((a: any) => a.status === "active").length,
          total_accounts: accts.length,
          groups: (groups.items || groups).length,
          contacts: contacts.total || contactsList.length || 0,
          total_reach: contacts.total || contactsList.length || 0,
          sent_today: sentToday,
          delivered,
          read,
          responses,
          history: history.slice(0, 10),
          quality: qualityBuckets,
        });
      })
    ).catch(() => {}).finally(() => setLoading(false));
  }, [auth?.token]);

  if (loading) return (
    <div className="space-y-6 animate-fade-in">
      <Skeleton className="h-8 w-40" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2">
            <Skeleton className="h-3 w-16" /><Skeleton className="h-7 w-20" />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-6xl animate-fade-slide-in">
      <h1 className="text-2xl font-bold text-zinc-100">{t("waOverview.title")}</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t("waOverview.connectedAccounts"), value: data ? `${data.connected_accounts}/${data.total_accounts}` : "—", icon: UserCircle, color: "text-emerald-400" },
          { label: t("waOverview.groups"), value: data?.groups ?? "—", icon: Radio, color: "text-sky-400" },
          { label: t("waOverview.contacts"), value: data?.contacts ?? "—", icon: UsersGroup, color: "text-violet-400" },
          { label: t("waOverview.totalReach"), value: data?.total_reach ?? "—", icon: ChartBar, color: "text-amber-400" },
        ].map((card, i) => (
          <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 card-hover">
            <div className="flex items-center gap-2 mb-2">
              <card.icon className={`w-4 h-4 ${card.color}`} />
              <p className="text-xs text-zinc-500">{card.label}</p>
            </div>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t("waOverview.sentToday"), value: data?.sent_today ?? "—", icon: Send, color: "text-blue-400" },
          { label: t("waOverview.delivered"), value: data?.delivered ?? "—", icon: CheckCircle, color: "text-emerald-400" },
          { label: t("waOverview.read"), value: data?.read ?? "—", icon: Eye, color: "text-sky-400" },
          { label: t("waOverview.responses"), value: data?.responses ?? "—", icon: MessageSquare, color: "text-violet-400" },
        ].map((card, i) => (
          <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 card-hover">
            <div className="flex items-center gap-2 mb-2">
              <card.icon className={`w-4 h-4 ${card.color}`} />
              <p className="text-xs text-zinc-500">{card.label}</p>
            </div>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h2 className="text-base font-semibold text-zinc-100 mb-4">{t("waOverview.mailingHistory")}</h2>
        {data?.history?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-zinc-500 border-b border-zinc-800">
                  <th className="text-left py-2 pr-4 font-medium">{t("waOverview.colDate")}</th>
                  <th className="text-left py-2 pr-4 font-medium">{t("waOverview.colCampaign")}</th>
                  <th className="text-left py-2 pr-4 font-medium">{t("waOverview.colPlatform")}</th>
                  <th className="text-right py-2 pr-4 font-medium">{t("waOverview.colRecipients")}</th>
                  <th className="text-right py-2 pr-4 font-medium">{t("waOverview.colDelivered")}</th>
                  <th className="text-right py-2 pr-4 font-medium">{t("waOverview.colRead")}</th>
                  <th className="text-right py-2 font-medium">{t("waOverview.colResponses")}</th>
                </tr>
              </thead>
              <tbody>
                {data.history.map((row: any, i: number) => (
                  <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                    <td className="py-2 pr-4 text-zinc-300">{row.date ? new Date(row.date).toLocaleDateString() : "—"}</td>
                    <td className="py-2 pr-4 text-zinc-200">{row.campaign}</td>
                    <td className="py-2 pr-4 text-zinc-400">{row.platform}</td>
                    <td className="py-2 pr-4 text-right text-zinc-300">{row.recipients}</td>
                    <td className="py-2 pr-4 text-right text-emerald-400">{row.delivered}</td>
                    <td className="py-2 pr-4 text-right text-sky-400">{row.read}</td>
                    <td className="py-2 text-right text-violet-400">{row.responses}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-zinc-500 text-sm">{t("waOverview.noData")}</p>
        )}
      </div>

      {Object.keys(data?.quality || {}).length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-base font-semibold text-zinc-100 mb-4">{t("waOverview.contactQuality")}</h2>
          <div className="flex flex-wrap gap-4">
            {Object.entries(data.quality).sort((a: [string, number], b: [string, number]) => b[1] - a[1]).map(([score, count]) => (
              <div key={score} className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-2">
                <span className={`w-3 h-3 rounded-full ${score === "hot" || score === "5" ? "bg-red-400" : score === "warm" || score === "4" ? "bg-amber-400" : score === "cold" || score === "3" ? "bg-blue-400" : "bg-zinc-500"}`} />
                <span className="text-sm text-zinc-300 capitalize">{score}</span>
                <span className="text-sm font-bold text-zinc-100">{String(count)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h2 className="text-base font-semibold text-zinc-100 mb-4">{t("waOverview.quickActions")}</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/wa-accounts"
            className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 hover:bg-zinc-700 transition btn-press">
            <UserCircle className="w-4 h-4" /> {t("waOverview.manageAccounts")}
          </Link>
          <Link href="/wa-groups"
            className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 hover:bg-zinc-700 transition btn-press">
            <Radio className="w-4 h-4" /> {t("waOverview.parseGroups")}
          </Link>
          <Link href="/contacts"
            className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 hover:bg-zinc-700 transition btn-press">
            <UsersGroup className="w-4 h-4" /> {t("waOverview.viewContacts")}
          </Link>
          <Link href="/mailings"
            className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 hover:bg-zinc-700 transition btn-press">
            <Megaphone className="w-4 h-4" /> {t("waOverview.sendMailings")}
          </Link>
        </div>
      </div>
    </div>
  );
}
