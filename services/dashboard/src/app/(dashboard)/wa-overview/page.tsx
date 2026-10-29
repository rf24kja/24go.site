"use client";

import { usePlatform } from "@/lib/platform";
import { useOverview, overviewCopy, OverviewNotice } from "@/lib/overview-state";
import Link from "@/components/PlatformLink";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Skeleton } from "@/components/Skeleton";
import { ChartBar, Radio, UsersGroup, UserCircle, Send, CheckCircle, Eye, MessageSquare, Megaphone } from "@/components/Icons";

export default function WaOverviewPage() {
  const { auth } = useAuth();
  const { t, lang } = useI18n();
  const { platform } = usePlatform();
  const copy = overviewCopy(lang);
  const { data, loading, failed, retry } = useOverview(`${auth?.token}:whatsapp:${platform}`, !!auth?.token && platform === 'whatsapp', async () => {
    const m = await import('@/lib/api');
    const results = await Promise.allSettled([
      m.getWaAccounts(auth!.token!), m.getWaGroups(auth!.token!),
      m.getContacts(auth!.token!, {platform:'whatsapp',limit:1}),
      m.getCampaigns(auth!.token!, {platform:'whatsapp',limit:20}),
    ] as const);
    const itemList = (i:number): any[] | null => {
      const r = results[i];
      return r.status === 'fulfilled' && Array.isArray(r.value.items) ? r.value.items : null;
    };
    const accounts = itemList(0), groups = itemList(1), campaigns = itemList(3);
    const contactResult = results[2];
    const contacts = contactResult.status === 'fulfilled' && typeof contactResult.value.total === 'number' && Number.isFinite(contactResult.value.total) && contactResult.value.total >= 0 ? contactResult.value.total : null;
    const available = [accounts,groups,contacts,campaigns].filter(x=>x!==null).length;
    if (!available) throw new Error('overview unavailable');
    return {
      partial:available < 4,
      connected_accounts:accounts === null ? null : accounts.filter(a=>a.status === 'active').length,
      total_accounts:accounts?.length ?? null, groups:groups?.length ?? null, contacts,
      total_reach:null, sent_today:null, delivered:null, read:null, responses:null,
      history:campaigns?.filter(c=>c.platform === 'whatsapp').map(c=>({date:c.created_at,campaign:c.name,platform:'WhatsApp',recipients:null,delivered:null,read:null,responses:null})),
      quality:{},
    };
  });

  if (loading) return (
    <div className="space-y-6 animate-fade-in" role="status" aria-label={copy.loading}>
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
      <p className="text-sm text-zinc-400">{copy.waScope}</p>
      {(failed || data?.partial) && <OverviewNotice text={failed ? copy.error : copy.partial} retry={retry} label={copy.retry} />}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t("waOverview.connectedAccounts"), value: data?.total_accounts != null ? `${data.connected_accounts}/${data.total_accounts}` : copy.unavailable, icon: UserCircle, color: "text-emerald-400" },
          { label: t("waOverview.groups"), value: data?.groups ?? copy.unavailable, icon: Radio, color: "text-sky-400" },
          { label: t("waOverview.contacts"), value: data?.contacts ?? copy.unavailable, icon: UsersGroup, color: "text-violet-400" },
          { label: t("waOverview.totalReach"), value: data?.total_reach ?? copy.unavailable, icon: ChartBar, color: "text-amber-400" },
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
          { label: t("waOverview.sentToday"), value: data?.sent_today ?? copy.unavailable, icon: Send, color: "text-blue-400" },
          { label: t("waOverview.delivered"), value: data?.delivered ?? copy.unavailable, icon: CheckCircle, color: "text-emerald-400" },
          { label: t("waOverview.read"), value: data?.read ?? copy.unavailable, icon: Eye, color: "text-sky-400" },
          { label: t("waOverview.responses"), value: data?.responses ?? copy.unavailable, icon: MessageSquare, color: "text-violet-400" },
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
        <h2 className="text-base font-semibold text-zinc-100 mb-4">{copy.history}</h2>
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
                    <td className="py-2 pr-4 text-right text-zinc-300">{row.recipients ?? copy.unavailable}</td>
                    <td className="py-2 pr-4 text-right text-emerald-400">{row.delivered ?? copy.unavailable}</td>
                    <td className="py-2 pr-4 text-right text-sky-400">{row.read ?? copy.unavailable}</td>
                    <td className="py-2 text-right text-violet-400">{row.responses ?? copy.unavailable}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-zinc-500 text-sm">{data?.history ? t("waOverview.noData") : copy.unavailable}</p>
        )}
      </div>


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
