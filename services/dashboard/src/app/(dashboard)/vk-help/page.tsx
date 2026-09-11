"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import {
  FileText, UsersGroup, Radar, Crosshair, Send, UserCircle, Scales,
  Megaphone, CreditCard, Cog, Zap, Shield, ExternalLink, Menu, Cross,
} from "@/components/Icons";

type SectionId =
  | "overview"
  | "communities"
  | "comment_scraper"
  | "outreach"
  | "posting"
  | "auto_replies"
  | "leads"
  | "rules"
  | "campaigns"
  | "proxies"
  | "anti_ban"
  | "settings";

interface NavItem {
  id: SectionId;
  icon: React.ElementType;
  labelKey: string;
}

function Section({
  id, icon: Icon, titleKey, forWhatKey, howToKey, expectKey, tipsKey, warningsKey, nextId, nextLabelKey, t,
}: {
  id: SectionId; icon: React.ElementType; titleKey: string; forWhatKey: string;
  howToKey: string; expectKey: string; tipsKey?: string; warningsKey?: string;
  nextId?: SectionId; nextLabelKey?: string; t: (k: string) => string;
}) {
  const howToItems: string[] = [];
  let i = 1;
  while (t(`${howToKey}.${i}`) !== `${howToKey}.${i}`) {
    howToItems.push(t(`${howToKey}.${i}`));
    i++;
  }
  const expectItems: string[] = [];
  i = 1;
  while (t(`${expectKey}.${i}`) !== `${expectKey}.${i}`) {
    expectItems.push(t(`${expectKey}.${i}`));
    i++;
  }

  return (
    <section id={id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-6 scroll-mt-20">
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2 bg-blue-500/10 rounded-lg">
          <Icon className="w-5 h-5 text-blue-400" />
        </div>
        <h2 className="text-xl font-bold text-zinc-100">{t(titleKey)}</h2>
      </div>
      <div className="space-y-6">
        <div>
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">{t("vkHelp.forWhat")}</h3>
          <div className="text-sm text-zinc-300 leading-relaxed">{t(forWhatKey)}</div>
        </div>
        <div>
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">{t("vkHelp.howTo")}</h3>
          <ol className="space-y-3">
            {howToItems.map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                <span className="text-sm text-zinc-300">{item}</span>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">{t("vkHelp.whatYouGet")}</h3>
          <ul className="space-y-2">
            {expectItems.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                <span className="text-zinc-500 mt-0.5">&#8226;</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        {tipsKey && t(tipsKey) !== tipsKey && (
          <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
            <Zap className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-emerald-300">{t(tipsKey)}</p>
          </div>
        )}
        {warningsKey && t(warningsKey) !== warningsKey && (
          <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
            <Shield className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-300">{t(warningsKey)}</p>
          </div>
        )}
        {nextId && nextLabelKey && (
          <div className="pt-4 border-t border-zinc-800 text-right">
            <a href={`#${nextId}`} className="inline-flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition">
              {t(nextLabelKey)} →
            </a>
          </div>
        )}
      </div>
    </section>
  );
}

const NAV: { id: SectionId; icon: React.ElementType; labelKey: string }[] = [
  { id: "overview", icon: FileText, labelKey: "vkHelp.nav.overview" },
  { id: "communities", icon: UsersGroup, labelKey: "vkHelp.nav.communities" },
  { id: "comment_scraper", icon: Radar, labelKey: "vkHelp.nav.commentScraper" },
  { id: "outreach", icon: Send, labelKey: "vkHelp.nav.outreach" },
  { id: "posting", icon: Megaphone, labelKey: "vkHelp.nav.posting" },
  { id: "auto_replies", icon: Send, labelKey: "vkHelp.nav.autoReplies" },
  { id: "leads", icon: Crosshair, labelKey: "vkHelp.nav.leads" },
  { id: "rules", icon: Scales, labelKey: "vkHelp.nav.leadRules" },
  { id: "campaigns", icon: Megaphone, labelKey: "vkHelp.nav.campaigns" },
  { id: "proxies", icon: ExternalLink, labelKey: "vkHelp.nav.proxies" },
  { id: "anti_ban", icon: Shield, labelKey: "vkHelp.nav.antiBan" },
  { id: "settings", icon: Cog, labelKey: "vkHelp.nav.settings" },
];

export default function VkHelpPage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t } = useI18n();

  return (
    <div className="flex flex-col md:flex-row gap-6 max-w-6xl animate-fade-slide-in">
      <button onClick={() => setMobileOpen(!mobileOpen)}
        className="md:hidden fixed top-14 left-4 z-50 bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-300">
        {mobileOpen ? <Cross className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      <nav className={`${mobileOpen ? "block" : "hidden"} md:block w-52 shrink-0 space-y-1`}>
        <h1 className="text-lg font-bold mb-4">{t("vkHelp.title")}</h1>
        {NAV.map((item) => (
          <a key={item.id} href={`#${item.id}`} onClick={() => setMobileOpen(false)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200 transition">
            <item.icon className="w-4 h-4 shrink-0" />{t(item.labelKey)}
          </a>
        ))}
      </nav>

      <div className="flex-1 min-w-0 space-y-2">
        <Section id="overview" icon={FileText} t={t}
          titleKey="vkHelp.overview.title" forWhatKey="vkHelp.overview.forWhat"
          howToKey="vkHelp.overview.howTo" expectKey="vkHelp.overview.expect"
          nextId="communities" nextLabelKey="vkHelp.nav.communities" />

        <Section id="communities" icon={UsersGroup} t={t}
          titleKey="vkHelp.communities.title" forWhatKey="vkHelp.communities.forWhat"
          howToKey="vkHelp.communities.howTo" expectKey="vkHelp.communities.expect"
          tipsKey="vkHelp.communities.tips"
          nextId="comment_scraper" nextLabelKey="vkHelp.nav.commentScraper" />

        <Section id="comment_scraper" icon={Radar} t={t}
          titleKey="vkHelp.commentScraper.title" forWhatKey="vkHelp.commentScraper.forWhat"
          howToKey="vkHelp.commentScraper.howTo" expectKey="vkHelp.commentScraper.expect"
          tipsKey="vkHelp.commentScraper.tips"
          nextId="outreach" nextLabelKey="vkHelp.nav.outreach" />

        <Section id="outreach" icon={Send} t={t}
          titleKey="vkHelp.outreach.title" forWhatKey="vkHelp.outreach.forWhat"
          howToKey="vkHelp.outreach.howTo" expectKey="vkHelp.outreach.expect"
          warningsKey="vkHelp.outreach.warnings"
          nextId="posting" nextLabelKey="vkHelp.nav.posting" />

        <Section id="posting" icon={Megaphone} t={t}
          titleKey="vkHelp.posting.title" forWhatKey="vkHelp.posting.forWhat"
          howToKey="vkHelp.posting.howTo" expectKey="vkHelp.posting.expect"
          tipsKey="vkHelp.posting.tips"
          nextId="auto_replies" nextLabelKey="vkHelp.nav.autoReplies" />

        <Section id="auto_replies" icon={Send} t={t}
          titleKey="vkHelp.autoReplies.title" forWhatKey="vkHelp.autoReplies.forWhat"
          howToKey="vkHelp.autoReplies.howTo" expectKey="vkHelp.autoReplies.expect"
          nextId="leads" nextLabelKey="vkHelp.nav.leads" />

        <Section id="leads" icon={Crosshair} t={t}
          titleKey="vkHelp.leads.title" forWhatKey="vkHelp.leads.forWhat"
          howToKey="vkHelp.leads.howTo" expectKey="vkHelp.leads.expect"
          nextId="rules" nextLabelKey="vkHelp.nav.leadRules" />

        <Section id="rules" icon={Scales} t={t}
          titleKey="vkHelp.leadRules.title" forWhatKey="vkHelp.leadRules.forWhat"
          howToKey="vkHelp.leadRules.howTo" expectKey="vkHelp.leadRules.expect"
          nextId="campaigns" nextLabelKey="vkHelp.nav.campaigns" />

        <Section id="campaigns" icon={Megaphone} t={t}
          titleKey="vkHelp.campaigns.title" forWhatKey="vkHelp.campaigns.forWhat"
          howToKey="vkHelp.campaigns.howTo" expectKey="vkHelp.campaigns.expect"
          nextId="proxies" nextLabelKey="vkHelp.nav.proxies" />

        <Section id="proxies" icon={ExternalLink} t={t}
          titleKey="vkHelp.proxies.title" forWhatKey="vkHelp.proxies.forWhat"
          howToKey="vkHelp.proxies.howTo" expectKey="vkHelp.proxies.expect"
          tipsKey="vkHelp.proxies.tips"
          nextId="anti_ban" nextLabelKey="vkHelp.nav.antiBan" />

        <Section id="anti_ban" icon={Shield} t={t}
          titleKey="vkHelp.antiBan.title" forWhatKey="vkHelp.antiBan.forWhat"
          howToKey="vkHelp.antiBan.howTo" expectKey="vkHelp.antiBan.expect"
          warningsKey="vkHelp.antiBan.warnings"
          nextId="settings" nextLabelKey="vkHelp.nav.settings" />

        <Section id="settings" icon={Cog} t={t}
          titleKey="vkHelp.settings.title" forWhatKey="vkHelp.settings.forWhat"
          howToKey="vkHelp.settings.howTo" expectKey="vkHelp.settings.expect" />
      </div>
    </div>
  );
}
