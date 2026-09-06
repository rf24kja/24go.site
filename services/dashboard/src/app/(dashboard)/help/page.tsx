"use client";

import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import {
  BookOpen,
  Users,
  Search,
  Eye,
  Send,
  UserCheck,
  Filter,
  Megaphone,
  CreditCard,
  UserCog,
  Lightbulb,
  AlertTriangle,
  ArrowRight,
  Menu,
  X,
  MessageSquare,
  Shield,
  Settings,
} from "lucide-react";

const ACCOUNTS_BUY_LINK = "https://sms-pro.guru/?ref=fc5190d3";

type SectionId =
  | "overview"
  | "accounts"
  | "search"
  | "monitoring"
  | "mailings"
  | "leads"
  | "rules"
  | "campaigns"
  | "autoReplies"
  | "proxies"
  | "settings"
  | "billing"
  | "team";

interface NavItem {
  id: SectionId;
  icon: React.ElementType;
  labelKey: string;
}

const NAV: NavItem[] = [
  { id: "overview", icon: BookOpen, labelKey: "wiki.nav.overview" },
  { id: "accounts", icon: Users, labelKey: "wiki.nav.accounts" },
  { id: "search", icon: Search, labelKey: "wiki.nav.search" },
  { id: "monitoring", icon: Eye, labelKey: "wiki.nav.monitoring" },
  { id: "mailings", icon: Send, labelKey: "wiki.nav.mailings" },
  { id: "leads", icon: UserCheck, labelKey: "wiki.nav.leads" },
  { id: "rules", icon: Filter, labelKey: "wiki.nav.rules" },
  { id: "campaigns", icon: Megaphone, labelKey: "wiki.nav.campaigns" },
  { id: "autoReplies", icon: MessageSquare, labelKey: "wiki.nav.autoReplies" },
  { id: "proxies", icon: Shield, labelKey: "wiki.nav.proxies" },
  { id: "settings", icon: Settings, labelKey: "wiki.nav.settings" },
  { id: "billing", icon: CreditCard, labelKey: "wiki.nav.billing" },
  { id: "team", icon: UserCog, labelKey: "wiki.nav.team" },
];

function MockBrowser({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl overflow-hidden border border-zinc-700 bg-zinc-800/50">
      <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border-b border-zinc-700">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-zinc-600" />
          <div className="w-2.5 h-2.5 rounded-full bg-zinc-600" />
          <div className="w-2.5 h-2.5 rounded-full bg-zinc-600" />
        </div>
        <div className="flex-1 mx-2">
          <div className="bg-zinc-900 rounded px-2 py-0.5 text-[10px] text-zinc-500 text-center truncate">
            24go.site
          </div>
        </div>
      </div>
      <div className="p-4 bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950">
        {children}
      </div>
    </div>
  );
}

function MockRow({ left, right, status }: { left: string; right: string; status?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded bg-zinc-900/50 text-xs">
      <span className="text-zinc-300">{left}</span>
      <div className="flex items-center gap-2">
        {status && <span className="text-zinc-500">{status}</span>}
        <span className="text-zinc-500">{right}</span>
      </div>
    </div>
  );
}

function StepList({ items }: { items: string[] }) {
  return (
    <ol className="space-y-3">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-3">
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center mt-0.5">
            {i + 1}
          </span>
          <span className="text-sm text-zinc-300">{item}</span>
        </li>
      ))}
    </ol>
  );
}

function ExpectList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
          <span className="text-zinc-500 mt-0.5">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Tip({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
      <Lightbulb className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
      <p className="text-sm text-emerald-300">{text}</p>
    </div>
  );
}

function Warning({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
      <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
      <p className="text-sm text-amber-300">{text}</p>
    </div>
  );
}

function Section({
  id,
  icon: Icon,
  title,
  forWhat,
  howTo,
  expect,
  tips,
  warnings,
  extra,
  nextId,
  nextLabel,
}: {
  id: SectionId;
  icon: React.ElementType;
  title: string;
  forWhat: string | React.ReactNode;
  howTo: string[];
  expect: string[];
  tips?: string;
  warnings?: string;
  extra?: React.ReactNode;
  nextId?: SectionId;
  nextLabel?: string;
}) {
  const { t } = useI18n();
  return (
    <section id={id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-6 scroll-mt-20">
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2 bg-emerald-500/10 rounded-lg">
          <Icon className="w-5 h-5 text-emerald-400" />
        </div>
        <h2 className="text-xl font-bold text-zinc-100">{title}</h2>
      </div>

      <div className="space-y-6">
        <div>
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
            {t("wiki.subhead.forWhat")}
          </h3>
          <div className="text-sm text-zinc-300 leading-relaxed">{forWhat}</div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
            {t("wiki.subhead.howTo")}
          </h3>
          <StepList items={howTo} />
        </div>

        <div>
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
            {t("wiki.subhead.expect")}
          </h3>
          <ExpectList items={expect} />
        </div>

        {tips && <Tip text={tips} />}
        {warnings && <Warning text={warnings} />}
        {extra && <div className="mt-2">{extra}</div>}

        {nextId && (
          <div className="pt-4 border-t border-zinc-800 text-right">
            <a
              href={`#${nextId}`}
              className="inline-flex items-center gap-1.5 text-sm text-emerald-400 hover:text-emerald-300 transition"
            >
              {nextLabel} <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        )}
      </div>
    </section>
  );
}

function OverviewSection({ t }: { t: (k: string) => string }) {
  return (
    <Section
      id="overview"
      icon={BookOpen}
      title={t("wiki.section.overview.title")}
      forWhat={
        <div className="space-y-2">
          <p>{t("wiki.section.overview.forWhat")}</p>
          <p className="text-zinc-400">{t("wiki.section.overview.architecture")}</p>
        </div>
      }
      howTo={t("wiki.section.overview.howTo").split("\n")}
      expect={t("wiki.section.overview.expect").split("\n")}
      tips={t("wiki.section.overview.tip")}
      nextId="accounts"
      nextLabel={t("wiki.nav.accounts")}
      extra={
        <MockBrowser>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { label: "Leads This Month", value: "1,247", color: "text-emerald-400" },
              { label: "Hot Leads", value: "89", color: "text-amber-400" },
              { label: "Accounts Active", value: "12", color: "text-blue-400" },
            ].map((s) => (
              <div key={s.label} className="bg-zinc-900/50 rounded-lg p-2 text-center">
                <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                <div className="text-[10px] text-zinc-500">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="space-y-1">
            <MockRow left="@marketing_tips" right="HOT • 2 min ago" status="scanning" />
            <MockRow left="@saas_founders" right="WARM • 15 min ago" status="scanning" />
            <MockRow left="@b2b_leads" right="COLD • 1 hr ago" status="idle" />
          </div>
        </MockBrowser>
      }
    />
  );
}

function AccountsSection({ t }: { t: (k: string) => string }) {
  return (
    <Section
      id="accounts"
      icon={Users}
      title={t("wiki.section.accounts.title")}
      forWhat={
        <div className="space-y-3">
          <p>{t("wiki.section.accounts.forWhat")}</p>
          <div className="bg-zinc-800/50 border border-emerald-500/20 rounded-lg p-4">
            <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">{t("wiki.section.accounts.getAccountsTitle")}</h4>
            <ul className="space-y-1.5 text-sm text-zinc-400">
              <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span><span>{t("wiki.section.accounts.get1")}</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span><span>{t("wiki.section.accounts.get2")}</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span>
                <span>{t("wiki.section.accounts.get3")} <a href={ACCOUNTS_BUY_LINK} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline font-medium">{t("wiki.section.accounts.buyLink")}</a></span>
              </li>
            </ul>
          </div>
        </div>
      }
      howTo={t("wiki.section.accounts.howTo").split("\n")}
      expect={t("wiki.section.accounts.expect").split("\n")}
      warnings={t("wiki.section.accounts.warning")}
      tips={t("wiki.section.accounts.buyTip")}
      extra={
        <div className="space-y-4">
          <MockBrowser>
            <div className="space-y-1">
              <MockRow left="+7 900 *** 1234" right="socks5://***active" status="active" />
              <MockRow left="+44 77 *** 5678" right="socks5://***warming" status="warming" />
              <MockRow left="+1 212 *** 9012" right="http://***active" status="active" />
            </div>
            <div className="mt-2 flex gap-2">
              <div className="px-2 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] rounded">+ Add Account</div>
              <div className="px-2 py-1 bg-zinc-700 text-zinc-400 text-[10px] rounded">Bulk Import</div>
            </div>
          </MockBrowser>
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
            <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">
              {t("wiki.subhead.accountTypes") || "Which accounts to use"}
            </h4>
            <ul className="space-y-1.5">
              {t("wiki.section.accounts.accountTypes").split("\n").map((line, i) => (
                <li key={i} className="text-sm text-zinc-400 flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5">•</span>
                  <span>{line.replace(/^•\s*/, "")}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      }
      nextId="search"
      nextLabel={t("wiki.nav.search")}
    />
  );
}

function SearchSection({ t }: { t: (k: string) => string }) {
  return (
    <Section
      id="search"
      icon={Search}
      title={t("wiki.section.search.title")}
      forWhat={
        <div className="space-y-3">
          <p>{t("wiki.section.search.forWhat")}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
              <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">{t("wiki.section.search.freeTitle")}</h4>
              <p className="text-sm text-zinc-400">{t("wiki.section.search.freeDesc")}</p>
            </div>
            <div className="bg-zinc-800/50 border border-emerald-500/20 rounded-lg p-4">
              <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">{t("wiki.section.search.premiumTitle")}</h4>
              <p className="text-sm text-zinc-400">{t("wiki.section.search.premiumDesc")}</p>
            </div>
          </div>
        </div>
      }
      howTo={[
        t("wiki.section.search.howTo1"),
        t("wiki.section.search.howTo2"),
        t("wiki.section.search.howTo3"),
        t("wiki.section.search.howTo4"),
        t("wiki.section.search.howTo5"),
        t("wiki.section.search.howTo6"),
      ]}
      expect={[
        t("wiki.section.search.expect1"),
        t("wiki.section.search.expect2"),
        t("wiki.section.search.expect3"),
        t("wiki.section.search.expect4"),
      ]}
      tips={t("wiki.section.search.tip")}
      nextId="monitoring"
      nextLabel={t("wiki.nav.monitoring")}
      extra={
        <MockBrowser>
          <div className="flex gap-2 mb-3">
            <div className="flex-1 bg-zinc-900/50 rounded px-2 py-1 text-xs text-zinc-300">real estate Moscow</div>
            <div className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded font-medium">Scan</div>
          </div>
          <div className="flex gap-2 mb-3">
            <div className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] rounded font-medium">Free</div>
            <div className="px-2 py-1 bg-zinc-700 text-zinc-400 text-[10px] rounded">TgStat (balance: 1,200)</div>
          </div>
          <div className="space-y-1">
            <MockRow left="@phuket_rentals" right="12.4K members • 89 msg/day" status="found" />
            <MockRow left="@moscow_realestate" right="8.2K members • 45 msg/day" status="found" />
            <MockRow left="@b2b_leads_moscow" right="34.1K members • 210 msg/day" status="found" />
          </div>
          <div className="mt-2 text-[10px] text-zinc-600 text-center">3 groups found — click Add to start monitoring</div>
        </MockBrowser>
      }
    />
  );
}

function MonitoringSection({ t }: { t: (k: string) => string }) {
  return (
    <Section
      id="monitoring"
      icon={Eye}
      title={t("wiki.section.monitoring.title")}
      forWhat={t("wiki.section.monitoring.forWhat")}
      howTo={[
        t("wiki.section.monitoring.howTo1"),
        t("wiki.section.monitoring.howTo2"),
        t("wiki.section.monitoring.howTo3"),
        t("wiki.section.monitoring.howTo4"),
        t("wiki.section.monitoring.howTo5"),
      ]}
      expect={[
        t("wiki.section.monitoring.expect1"),
        t("wiki.section.monitoring.expect2"),
        t("wiki.section.monitoring.expect3"),
        t("wiki.section.monitoring.expect4"),
        t("wiki.section.monitoring.expect5"),
        t("wiki.section.monitoring.expect6"),
      ]}
      tips={t("wiki.section.monitoring.tip")}
      nextId="mailings"
      nextLabel={t("wiki.nav.mailings")}
      extra={
        <div className="space-y-4">
          <MockBrowser>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-zinc-400">Scanning 2 groups, 847 messages/hour</span>
              <span className="text-[10px] text-emerald-400">● Live</span>
            </div>
            <div className="space-y-1">
              <MockRow left="@marketing_tips" right="12.4K • 234 msg/hr" status="scanning" />
              <MockRow left="@saas_founders" right="8.2K • 89 msg/hr" status="scanning" />
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1 text-center">
              <div className="bg-emerald-500/10 rounded py-1 text-[10px] text-emerald-400">HOT: 12</div>
              <div className="bg-amber-500/10 rounded py-1 text-[10px] text-amber-400">WARM: 34</div>
              <div className="bg-zinc-700/50 rounded py-1 text-[10px] text-zinc-400">COLD: 89</div>
            </div>
          </MockBrowser>
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
            <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-3">
              {t("wiki.subhead.timeline") || "Expected Timeline"}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="bg-zinc-900/50 rounded-lg p-3">
                <p className="text-emerald-400 font-medium mb-1">{t("wiki.section.monitoring.timeline.first.title")}</p>
                <p className="text-zinc-400">{t("wiki.section.monitoring.timeline.first.desc")}</p>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-3">
                <p className="text-emerald-400 font-medium mb-1">{t("wiki.section.monitoring.timeline.week.title")}</p>
                <p className="text-zinc-400">{t("wiki.section.monitoring.timeline.week.desc")}</p>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-3">
                <p className="text-emerald-400 font-medium mb-1">{t("wiki.section.monitoring.timeline.ongoing.title")}</p>
                <p className="text-zinc-400">{t("wiki.section.monitoring.timeline.ongoing.desc")}</p>
              </div>
            </div>
          </div>
        </div>
      }
    />
  );
}

function MailingsSection({ t }: { t: (k: string) => string }) {
  return (
    <Section
      id="mailings"
      icon={Send}
      title={t("wiki.section.mailings.title")}
      forWhat={
        <div className="space-y-3">
          <p>{t("wiki.section.mailings.forWhat")}</p>
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
            <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">{t("wiki.section.mailings.controlsTitle")}</h4>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="bg-emerald-500/10 rounded-lg p-3 text-center">
                <p className="text-emerald-400 font-medium">{t("wiki.section.mailings.controlStart")}</p>
                <p className="text-zinc-500 text-xs">{t("wiki.section.mailings.controlStartDesc")}</p>
              </div>
              <div className="bg-amber-500/10 rounded-lg p-3 text-center">
                <p className="text-amber-400 font-medium">{t("wiki.section.mailings.controlPause")}</p>
                <p className="text-zinc-500 text-xs">{t("wiki.section.mailings.controlPauseDesc")}</p>
              </div>
              <div className="bg-red-500/10 rounded-lg p-3 text-center">
                <p className="text-red-400 font-medium">{t("wiki.section.mailings.controlStop")}</p>
                <p className="text-zinc-500 text-xs">{t("wiki.section.mailings.controlStopDesc")}</p>
              </div>
            </div>
          </div>
        </div>
      }
      howTo={[
        t("wiki.section.mailings.howTo1"),
        t("wiki.section.mailings.howTo2"),
        t("wiki.section.mailings.howTo3"),
        t("wiki.section.mailings.howTo4"),
        t("wiki.section.mailings.howTo5"),
        t("wiki.section.mailings.howTo6"),
        t("wiki.section.mailings.howTo7"),
      ]}
      expect={[
        t("wiki.section.mailings.expect1"),
        t("wiki.section.mailings.expect2"),
        t("wiki.section.mailings.expect3"),
        t("wiki.section.mailings.expect4"),
      ]}
      warnings={t("wiki.section.mailings.warning")}
      nextId="leads"
      nextLabel={t("wiki.nav.leads")}
      extra={
        <MockBrowser>
          <div className="space-y-1">
            <MockRow left="Welcome to {group}" right="1,247 sent" status="active" />
            <MockRow left="Special offer for {name}" right="534 sent" status="paused" />
          </div>
        </MockBrowser>
      }
    />
  );
}

function LeadsSection({ t }: { t: (k: string) => string }) {
  return (
    <Section
      id="leads"
      icon={UserCheck}
      title={t("wiki.section.leads.title")}
      forWhat={
        <div className="space-y-3">
          <p>{t("wiki.section.leads.forWhat")}</p>
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
            <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">{t("wiki.section.leads.pipelineTitle")}</h4>
            <div className="flex gap-2 flex-wrap">
              {[
                { label: "HOT", color: "bg-emerald-500/20 text-emerald-400" },
                { label: "WARM", color: "bg-amber-500/20 text-amber-400" },
                { label: "COLD", color: "bg-blue-500/20 text-blue-400" },
              ].map(({ label, color }) => (
                <div key={label} className={`px-2 py-1 text-[10px] rounded font-medium ${color}`}>{label}</div>
              ))}
            </div>
          </div>
        </div>
      }
      howTo={[
        t("wiki.section.leads.howTo1"),
        t("wiki.section.leads.howTo2"),
        t("wiki.section.leads.howTo3"),
        t("wiki.section.leads.howTo4"),
        t("wiki.section.leads.howTo5"),
        t("wiki.section.leads.howTo6"),
      ]}
      expect={[
        t("wiki.section.leads.expect1"),
        t("wiki.section.leads.expect2"),
        t("wiki.section.leads.expect3"),
        t("wiki.section.leads.expect4"),
      ]}
      nextId="rules"
      nextLabel={t("wiki.nav.rules")}
      extra={
        <MockBrowser>
          <div className="flex gap-2 mb-2">
            <div className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] rounded font-medium">HOT</div>
            <div className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] rounded">WARM</div>
            <div className="px-2 py-0.5 bg-zinc-700 text-zinc-400 text-[10px] rounded">COLD</div>
          </div>
          <div className="space-y-1">
            <MockRow left="@alex_buyer" right="HOT - wants to rent" status="new" />
            <MockRow left="@maria_invest" right="HOT - asking about price" status="in_progress" />
          </div>
        </MockBrowser>
      }
    />
  );
}

function RulesSection({ t }: { t: (k: string) => string }) {
  return (
    <Section
      id="rules"
      icon={Filter}
      title={t("wiki.section.rules.title")}
      forWhat={t("wiki.section.rules.forWhat")}
      howTo={t("wiki.section.rules.howTo").split("\n")}
      expect={t("wiki.section.rules.expect").split("\n")}
      tips={t("wiki.section.rules.tip")}
      nextId="campaigns"
      nextLabel={t("wiki.nav.campaigns")}
      extra={
        <div className="space-y-4">
          <MockBrowser>
            <div className="space-y-1">
              <MockRow left="Buy/rent keyword match" right="Score: +50 → HOT" status="active" />
              <MockRow left="Price inquiry detected" right="Score: +30 → WARM" status="active" />
              <MockRow left="Spam/link filter" right="Score: -100 → SPAM" status="active" />
            </div>
          </MockBrowser>
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
            <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-3">
              {t("wiki.subhead.scoring") || "Scoring Formula"}
            </h4>
            <div className="text-sm text-zinc-400 space-y-2">
              <p>{t("wiki.section.rules.scoring")}</p>
              <div className="bg-zinc-900/50 rounded-lg p-3 font-mono text-xs text-zinc-300">
                {t("wiki.section.rules.scoringFormula")}
              </div>
            </div>
          </div>
        </div>
      }
    />
  );
}

function CampaignsSection({ t }: { t: (k: string) => string }) {
  return (
    <Section
      id="campaigns"
      icon={Megaphone}
      title={t("wiki.section.campaigns.title")}
      forWhat={
        <div className="space-y-3">
          <p>{t("wiki.section.campaigns.forWhat")}</p>
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
            <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-3">{t("wiki.section.campaigns.componentsTitle")}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="bg-zinc-900/50 rounded-lg p-3">
                <p className="text-emerald-400 font-medium mb-1">{t("wiki.section.campaigns.whatTitle")}</p>
                <p className="text-zinc-400">{t("wiki.section.campaigns.whatDesc")}</p>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-3">
                <p className="text-emerald-400 font-medium mb-1">{t("wiki.section.campaigns.howPostTitle")}</p>
                <p className="text-zinc-400">{t("wiki.section.campaigns.howPostDesc")}</p>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-3">
                <p className="text-emerald-400 font-medium mb-1">{t("wiki.section.campaigns.whenTitle")}</p>
                <p className="text-zinc-400">{t("wiki.section.campaigns.whenDesc")}</p>
              </div>
            </div>
          </div>
        </div>
      }
      howTo={[
        t("wiki.section.campaigns.howTo1"),
        t("wiki.section.campaigns.howTo2"),
        t("wiki.section.campaigns.howTo3"),
        t("wiki.section.campaigns.howTo4"),
        t("wiki.section.campaigns.howTo5"),
        t("wiki.section.campaigns.howTo6"),
        t("wiki.section.campaigns.howTo7"),
      ]}
      expect={[
        t("wiki.section.campaigns.expect1"),
        t("wiki.section.campaigns.expect2"),
        t("wiki.section.campaigns.expect3"),
        t("wiki.section.campaigns.expect4"),
      ]}
      nextId="autoReplies"
      nextLabel={t("wiki.nav.autoReplies")}
      extra={
        <div className="space-y-4">
          <MockBrowser>
            <div className="space-y-2">
              <MockRow left="Welcome {first_name}!" right="cron: 0 10 * * 1-5" status="active" />
              <MockRow left="Special offer for {group}" right="cron: 0 18 * * *" status="active" />
              <MockRow left="New listing available" right="manual" status="paused" />
            </div>
          </MockBrowser>
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
            <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">{t("wiki.section.campaigns.cronTitle")}</h4>
            <div className="space-y-1.5 font-mono text-xs">
              <div className="flex items-center gap-3"><code className="text-emerald-300 bg-zinc-900/50 px-1.5 py-0.5 rounded">0 10 * * 1-5</code><span className="text-zinc-400">{t("wiki.section.campaigns.cron1")}</span></div>
              <div className="flex items-center gap-3"><code className="text-emerald-300 bg-zinc-900/50 px-1.5 py-0.5 rounded">*/30 * * * *</code><span className="text-zinc-400">{t("wiki.section.campaigns.cron2")}</span></div>
              <div className="flex items-center gap-3"><code className="text-emerald-300 bg-zinc-900/50 px-1.5 py-0.5 rounded">0 9,18 * * *</code><span className="text-zinc-400">{t("wiki.section.campaigns.cron3")}</span></div>
              <div className="flex items-center gap-3"><code className="text-emerald-300 bg-zinc-900/50 px-1.5 py-0.5 rounded">0 12 * * 0</code><span className="text-zinc-400">{t("wiki.section.campaigns.cron4")}</span></div>
            </div>
          </div>
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
            <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">{t("wiki.section.campaigns.abTitle")}</h4>
            <ul className="space-y-1.5 text-sm text-zinc-400">
              <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span><span>{t("wiki.section.campaigns.ab1")}</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span><span>{t("wiki.section.campaigns.ab2")}</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span><span>{t("wiki.section.campaigns.ab3")}</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span><span>{t("wiki.section.campaigns.ab4")}</span></li>
            </ul>
          </div>
          <Warning text={t("wiki.section.campaigns.warning")} />
        </div>
      }
    />
  );
}

function AutoRepliesSection({ t }: { t: (k: string) => string }) {
  return (
    <Section
      id="autoReplies"
      icon={MessageSquare}
      title={t("wiki.section.autoReplies.title")}
      forWhat={
        <div className="space-y-3">
          <p>{t("wiki.section.autoReplies.forWhat")}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
              <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">{t("wiki.section.autoReplies.keywordTitle")}</h4>
              <p className="text-sm text-zinc-400">{t("wiki.section.autoReplies.keywordDesc")}</p>
            </div>
            <div className="bg-zinc-800/50 border border-emerald-500/20 rounded-lg p-4">
              <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">{t("wiki.section.autoReplies.aiTitle")}</h4>
              <p className="text-sm text-zinc-400">{t("wiki.section.autoReplies.aiDesc")}</p>
            </div>
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
              <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">{t("wiki.section.autoReplies.rotationTitle")}</h4>
              <p className="text-sm text-zinc-400">{t("wiki.section.autoReplies.rotationDesc")}</p>
            </div>
          </div>
        </div>
      }
      howTo={[
        t("wiki.section.autoReplies.howTo1"),
        t("wiki.section.autoReplies.howTo2"),
        t("wiki.section.autoReplies.howTo3"),
        t("wiki.section.autoReplies.howTo4"),
        t("wiki.section.autoReplies.howTo5"),
        t("wiki.section.autoReplies.howTo6"),
        t("wiki.section.autoReplies.howTo7"),
      ]}
      expect={[
        t("wiki.section.autoReplies.expect1"),
        t("wiki.section.autoReplies.expect2"),
        t("wiki.section.autoReplies.expect3"),
        t("wiki.section.autoReplies.expect4"),
      ]}
      tips={t("wiki.section.autoReplies.tip")}
      nextId="proxies"
      nextLabel={t("wiki.nav.proxies")}
      extra={
        <div className="space-y-4">
          <MockBrowser>
            <div className="flex gap-2 mb-3">
              <div className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] rounded font-medium">Keyword</div>
              <div className="px-2 py-1 bg-zinc-700 text-zinc-400 text-[10px] rounded">AI Agent</div>
              <div className="px-2 py-1 bg-zinc-700 text-zinc-400 text-[10px] rounded">Rotation</div>
            </div>
            <div className="space-y-1">
              <MockRow left="price / pricing" right="Price list reply" status="active" />
              <MockRow left="hello / hi / hey" right="Welcome message" status="active" />
            </div>
          </MockBrowser>
          <Tip text={t("wiki.section.autoReplies.bulkTip")} />
        </div>
      }
    />
  );
}

function ProxiesSection({ t }: { t: (k: string) => string }) {
  return (
    <Section
      id="proxies"
      icon={Shield}
      title={t("wiki.section.proxies.title")}
      forWhat={
        <div className="space-y-3">
          <p>{t("wiki.section.proxies.forWhat")}</p>
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
            <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">{t("wiki.section.proxies.whyTitle")}</h4>
            <ul className="space-y-1.5 text-sm text-zinc-400">
              <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span><span>{t("wiki.section.proxies.why1")}</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span><span>{t("wiki.section.proxies.why2")}</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span><span>{t("wiki.section.proxies.why3")}</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span><span>{t("wiki.section.proxies.why4")}</span></li>
            </ul>
          </div>
        </div>
      }
      howTo={[
        t("wiki.section.proxies.howTo1"),
        t("wiki.section.proxies.howTo2"),
        t("wiki.section.proxies.howTo3"),
        t("wiki.section.proxies.howTo4"),
        t("wiki.section.proxies.howTo5"),
        t("wiki.section.proxies.howTo6"),
      ]}
      expect={[
        t("wiki.section.proxies.expect1"),
        t("wiki.section.proxies.expect2"),
        t("wiki.section.proxies.expect3"),
      ]}
      tips={t("wiki.section.proxies.tip")}
      nextId="settings"
      nextLabel={t("wiki.nav.settings")}
      extra={
        <div className="space-y-4">
          <MockBrowser>
            <div className="space-y-1">
              <MockRow left="socks5://de.proxy.com:1080" right="Germany - 45ms" status="active" />
              <MockRow left="socks5://nl.proxy.com:1080" right="Netherlands - 62ms" status="active" />
            </div>
          </MockBrowser>
          <Warning text={t("wiki.section.proxies.warning")} />
        </div>
      }
    />
  );
}

function SettingsSection({ t }: { t: (k: string) => string }) {
  return (
    <Section
      id="settings"
      icon={Settings}
      title={t("wiki.section.settings.title")}
      forWhat={
        <div className="space-y-3">
          <p>{t("wiki.section.settings.forWhat")}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { tab: "LLM", descKey: "wiki.section.settings.tabLLM" },
              { tab: "Warmup", descKey: "wiki.section.settings.tabWarmup" },
              { tab: "Posting", descKey: "wiki.section.settings.tabPosting" },
              { tab: "Notifications", descKey: "wiki.section.settings.tabNotifications" },
              { tab: "Auto-Reply", descKey: "wiki.section.settings.tabAutoReply" },
              { tab: "Groups", descKey: "wiki.section.settings.tabGroups" },
              { tab: "Webhooks", descKey: "wiki.section.settings.tabWebhooks" },
              { tab: "Security", descKey: "wiki.section.settings.tabSecurity" },
              { tab: "Data", descKey: "wiki.section.settings.tabData" },
              { tab: "Account", descKey: "wiki.section.settings.tabAccount" },
            ].map(({ tab, descKey }) => (
              <div key={tab} className="bg-zinc-900/50 rounded-lg p-3">
                <p className="text-emerald-400 font-medium text-sm mb-0.5">{tab}</p>
                <p className="text-zinc-500 text-xs">{t(descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      }
      howTo={[
        t("wiki.section.settings.howTo1"),
        t("wiki.section.settings.howTo2"),
        t("wiki.section.settings.howTo3"),
        t("wiki.section.settings.howTo4"),
        t("wiki.section.settings.howTo5"),
      ]}
      expect={[
        t("wiki.section.settings.expect1"),
        t("wiki.section.settings.expect2"),
        t("wiki.section.settings.expect3"),
        t("wiki.section.settings.expect4"),
      ]}
      nextId="billing"
      nextLabel={t("wiki.nav.billing")}
      extra={
        <MockBrowser>
          <div className="flex gap-1 mb-3 overflow-x-auto">
            {["LLM", "Warmup", "Posting", "Webhooks", "Security", "Data"].map((tab, i) => (
              <div key={tab} className={`px-2 py-1 text-[10px] rounded whitespace-nowrap ${i === 0 ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-700 text-zinc-400"}`}>{tab}</div>
            ))}
          </div>
          <div className="space-y-2">
            <MockRow left="LLM Provider" right="OpenRouter (gpt-4o-mini)" />
            <MockRow left="API Key" right="sk-or-v1-***" />
            <MockRow left="Warmup Duration" right="3-5 days" />
            <MockRow left="Max Messages/Day" right="15 per account" />
          </div>
        </MockBrowser>
      }
    />
  );
}

function BillingSection({ t }: { t: (k: string) => string }) {
  return (
    <Section
      id="billing"
      icon={CreditCard}
      title={t("wiki.section.billing.title")}
      forWhat={
        <div className="space-y-4">
          <p>{t("wiki.section.billing.forWhat")}</p>
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg overflow-hidden">
            <div className="grid grid-cols-4 gap-px bg-zinc-700">
              <div className="bg-zinc-800 p-3 text-xs font-semibold text-zinc-500">{t("wiki.section.billing.tablePlan")}</div>
              <div className="bg-zinc-800 p-3 text-xs font-semibold text-emerald-400 text-center">{t("wiki.section.billing.tableStarter")}</div>
              <div className="bg-zinc-800 p-3 text-xs font-semibold text-blue-400 text-center">{t("wiki.section.billing.tablePro")}</div>
              <div className="bg-zinc-800 p-3 text-xs font-semibold text-amber-400 text-center">{t("wiki.section.billing.tableEnterprise")}</div>
              {[
                ["price", t("wiki.section.billing.tablePrice75"), t("wiki.section.billing.tablePrice199"), t("wiki.section.billing.tablePrice499")],
                ["trial", t("wiki.section.billing.table3days"), t("wiki.section.billing.table3days"), t("wiki.section.billing.table3days")],
                ["tgstat", t("wiki.section.billing.tableNo"), t("wiki.section.billing.tableYes"), t("wiki.section.billing.tableYes")],
                ["api", t("wiki.section.billing.tableNo"), t("wiki.section.billing.tableNo"), t("wiki.section.billing.tableYes")],
                ["team", t("wiki.section.billing.tableNo"), t("wiki.section.billing.tableYes"), t("wiki.section.billing.tableYes")],
              ].map(([feat, s, p, e]) => (
                <div key={feat} className="contents">
                  <div className="bg-zinc-900/50 p-2 text-xs text-zinc-400">{t(`wiki.section.billing.table${String(feat).charAt(0).toUpperCase()}${String(feat).slice(1)}`)}</div>
                  <div className="bg-zinc-900/50 p-2 text-xs text-zinc-300 text-center">{s}</div>
                  <div className="bg-zinc-900/50 p-2 text-xs text-zinc-300 text-center">{p}</div>
                  <div className="bg-zinc-900/50 p-2 text-xs text-zinc-300 text-center">{e}</div>
                </div>
              ))}
            </div>
          </div>
          <Warning text={t("wiki.section.billing.blogWarning")} />
        </div>
      }
      howTo={[
        t("wiki.section.billing.howTo1"),
        t("wiki.section.billing.howTo2"),
        t("wiki.section.billing.howTo3"),
        t("wiki.section.billing.howTo4"),
        t("wiki.section.billing.howTo5"),
        t("wiki.section.billing.howTo6"),
      ]}
      expect={[
        t("wiki.section.billing.expect1"),
        t("wiki.section.billing.expect2"),
        t("wiki.section.billing.expect3"),
        t("wiki.section.billing.expect4"),
      ]}
      nextId="team"
      nextLabel={t("wiki.nav.team")}
      extra={
        <div className="space-y-4">
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
            <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">{t("wiki.section.billing.paymentTitle")}</h4>
            <ul className="space-y-1.5 text-sm text-zinc-400">
              <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span><span><strong className="text-zinc-300">Stripe</strong> — {t("wiki.section.billing.paymentStripe")}</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span><span><strong className="text-zinc-300">YooKassa</strong> — {t("wiki.section.billing.paymentYoo")}</span></li>
            </ul>
          </div>
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
            <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">{t("wiki.section.billing.extraTitle")}</h4>
            <ul className="space-y-1.5 text-sm text-zinc-400">
              <li className="flex items-start gap-2"><span className="text-amber-500 mt-0.5">•</span><span><strong className="text-zinc-300">Telegram</strong> — {t("wiki.section.billing.extraAccounts")} (<a href={ACCOUNTS_BUY_LINK} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">sms-pro.guru</a>)</span></li>
              <li className="flex items-start gap-2"><span className="text-amber-500 mt-0.5">•</span><span><strong className="text-zinc-300">Proxies</strong> — {t("wiki.section.billing.extraProxies")}</span></li>
              <li className="flex items-start gap-2"><span className="text-amber-500 mt-0.5">•</span><span><strong className="text-zinc-300">TgStat</strong> — {t("wiki.section.billing.extraTgstat")}</span></li>
              <li className="flex items-start gap-2"><span className="text-amber-500 mt-0.5">•</span><span><strong className="text-zinc-300">LLM</strong> — {t("wiki.section.billing.extraLlm")}</span></li>
            </ul>
          </div>
          <div className="bg-zinc-800/50 border border-emerald-500/20 rounded-lg p-4">
            <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">{t("wiki.section.billing.tgstatTitle")}</h4>
            <ul className="space-y-1.5 text-sm text-zinc-400">
              <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span><span>{t("wiki.section.billing.tgstatAvail")}</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span><span>{t("wiki.section.billing.tgstatToken")}</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span><span>{t("wiki.section.billing.tgstatBalance")}</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span><span>{t("wiki.section.billing.tgstatFree")}</span></li>
            </ul>
          </div>
        </div>
      }
    />
  );
}

function TeamSection({ t }: { t: (k: string) => string }) {
  return (
    <section id="team" className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-6 scroll-mt-20">
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2 bg-emerald-500/10 rounded-lg">
          <UserCog className="w-5 h-5 text-emerald-400" />
        </div>
        <h2 className="text-xl font-bold text-zinc-100">{t("wiki.section.team.title")}</h2>
      </div>
      <div className="space-y-6">
        <div>
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">{t("wiki.subhead.forWhat")}</h3>
          <p className="text-sm text-zinc-300">{t("wiki.section.team.forWhat")}</p>
        </div>
        <div>
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">{t("wiki.section.team.rolesTitle")}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
              <p className="text-emerald-400 font-medium mb-1">{t("wiki.section.team.ownerTitle")}</p>
              <ul className="space-y-1 text-xs text-zinc-400">
                <li>• {t("wiki.section.team.owner1")}</li>
                <li>• {t("wiki.section.team.owner2")}</li>
                <li>• {t("wiki.section.team.owner3")}</li>
                <li>• {t("wiki.section.team.owner4")}</li>
              </ul>
            </div>
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
              <p className="text-blue-400 font-medium mb-1">{t("wiki.section.team.managerTitle")}</p>
              <ul className="space-y-1 text-xs text-zinc-400">
                <li>• {t("wiki.section.team.manager1")}</li>
                <li>• {t("wiki.section.team.manager2")}</li>
                <li>• {t("wiki.section.team.manager3")}</li>
                <li>• {t("wiki.section.team.manager4")}</li>
              </ul>
            </div>
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
              <p className="text-zinc-400 font-medium mb-1">{t("wiki.section.team.agentTitle")}</p>
              <ul className="space-y-1 text-xs text-zinc-400">
                <li>• {t("wiki.section.team.agent1")}</li>
                <li>• {t("wiki.section.team.agent2")}</li>
                <li>• {t("wiki.section.team.agent3")}</li>
                <li>• {t("wiki.section.team.agent4")}</li>
              </ul>
            </div>
          </div>
        </div>
        <div>
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">{t("wiki.subhead.howTo")}</h3>
          <StepList items={[
            t("wiki.section.team.howTo1"),
            t("wiki.section.team.howTo2"),
            t("wiki.section.team.howTo3"),
            t("wiki.section.team.howTo4"),
            t("wiki.section.team.howTo5"),
            t("wiki.section.team.howTo6"),
            t("wiki.section.team.howTo7"),
          ]} />
        </div>
      </div>
    </section>
  );
}

const SECTION_COMPONENTS: Record<SectionId, React.ComponentType<{ t: (k: string) => string }>> = {
  overview: OverviewSection,
  accounts: AccountsSection,
  search: SearchSection,
  monitoring: MonitoringSection,
  mailings: MailingsSection,
  leads: LeadsSection,
  rules: RulesSection,
  campaigns: CampaignsSection,
  autoReplies: AutoRepliesSection,
  proxies: ProxiesSection,
  settings: SettingsSection,
  billing: BillingSection,
  team: TeamSection,
};

export default function HelpPage() {
  const { t } = useI18n();
  const [active, setActive] = useState<SectionId>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(entry.target.id as SectionId);
          }
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 }
    );

    NAV.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: SectionId) => {
    setActive(id);
    setSidebarOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="animate-fade-slide-in">
      {/* Mobile quick-nav toggle */}
      <div className="lg:hidden sticky top-0 z-30 bg-zinc-950/80 backdrop-blur border-b border-zinc-800 px-4 py-2">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200"
        >
          {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          {t("wiki.quickNav")}
        </button>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex gap-8 max-w-7xl mx-auto">
        {/* Sidebar */}
        <aside
          className={`
            fixed lg:sticky top-0 lg:top-4 left-0 z-50 lg:z-auto
            w-64 h-screen lg:h-auto lg:max-h-[calc(100vh-2rem)]
            bg-zinc-950 lg:bg-transparent border-r lg:border-r-0 border-zinc-800
            overflow-y-auto lg:overflow-visible
            transform transition-transform lg:transform-none
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
            pt-16 lg:pt-0 pb-8 px-4 lg:px-0
            flex-shrink-0
          `}
        >
          <div className="sticky top-4">
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4 px-3">
              {t("wiki.title")}
            </h2>
            <nav className="space-y-1">
              {NAV.map(({ id, icon: Icon, labelKey }) => (
                <button
                  key={id}
                  onClick={() => scrollTo(id)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition
                    ${active === id
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 border border-transparent"
                    }
                  `}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {t(labelKey)}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 py-4 pr-4 lg:pr-8">
          <h1 className="text-2xl font-bold text-zinc-100 mb-2">{t("wiki.title")}</h1>
          <p className="text-zinc-500 text-sm mb-8">{t("wiki.subtitle")}</p>

          {NAV.map(({ id }) => {
            const Comp = SECTION_COMPONENTS[id];
            return <Comp key={id} t={t} />;
          })}

          {/* Support footer */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 text-center mt-4">
            <p className="text-zinc-400 text-sm">{t("guide.support")}</p>
            <a
              href="mailto:support@24go.site"
              className="text-emerald-400 text-sm font-medium hover:underline mt-1 inline-block"
            >
              support@24go.site
            </a>
          </div>
        </main>
      </div>
    </div>
  );
}
