"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Skeleton } from "@/components/Skeleton";
import { ChartBar, Radio, UsersGroup, UserCircle } from "@/components/Icons";

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
        m.getContacts(auth.token!, { limit: 0 }).catch(() => ({ total: 0 })),
      ]).then(([accounts, groups, contacts]) => {
        const accts = accounts.items || accounts;
        setData({
          connected_accounts: accts.filter((a: any) => a.status === "active").length,
          total_accounts: accts.length,
          groups: (groups.items || groups).length,
          contacts: contacts.total || 0,
        });
      })
    ).catch(() => {}).finally(() => setLoading(false));
  }, [auth?.token]);

  if (loading) return (
    <div className="space-y-6 animate-fade-in">
      <Skeleton className="h-8 w-40" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
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
          { label: t("waOverview.inTelegram"), value: "—", icon: ChartBar, color: "text-zinc-400" },
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

      {/* Quick actions */}
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
            <ChartBar className="w-4 h-4" /> {t("waOverview.sendMailings")}
          </Link>
        </div>
      </div>
    </div>
  );
}
