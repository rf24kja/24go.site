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
            <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">Where to Get Accounts</h4>
            <ul className="space-y-1.5 text-sm text-zinc-400">
              <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span><span>Buy ready-made accounts with sessions — fastest option</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span><span>Use your own SIM cards (manual registration)</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span>
                <span>Recommended service: <a href={ACCOUNTS_BUY_LINK} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline font-medium">sms-pro.guru</a> — buy accounts in bulk with .session files</span>
              </li>
            </ul>
          </div>
        </div>
      }
      howTo={[
        'Click "Add Account" to create a new account entry',
        "Enter phone number and assign a proxy (SOCKS5 recommended)",
        "For bulk import: upload .json + .session files from Telegram Desktop or purchased accounts",
        'Click "Connect" — enter the Telegram activation code',
        "If 2FA is enabled: enter your 2FA password in the password field",
        'For VK: click "Connect VK", authorize in the popup',
        'Use "Connect All" to connect up to 10 accounts at once',
      ]}
      expect={[
        "Account status changes: Disconnected → Warming → Active",
        "Warm-up takes 3-5 days (automatic daily messages)",
        "After warm-up, account is ready for campaigns",
        "Each account gets its own proxy (1 proxy = 1 account, never change)",
        "Max 50 accounts per creation, max 10 per bulk connect",
      ]}
      warnings="NEVER change proxy on a connected account — it causes an immediate Telegram ban. Each account must keep its original proxy forever."
      tips="Buy accounts from sms-pro.guru for fastest setup — you get phone + session file ready to import. Or use your own SIM cards for full control."
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
              <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">Free Search (Built-in)</h4>
              <ul className="space-y-1.5 text-sm text-zinc-400">
                <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span><span>Uses Telegram API to search public groups by keywords</span></li>
                <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span><span>Enter keywords → click Scan → see results</span></li>
                <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span><span>Shows group name, member count, relevance</span></li>
                <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span><span>Click result to add for monitoring</span></li>
                <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span><span className="text-emerald-300 font-medium">Free, unlimited searches</span></li>
              </ul>
            </div>
            <div className="bg-zinc-800/50 border border-emerald-500/20 rounded-lg p-4">
              <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">TgStat Search (Premium)</h4>
              <ul className="space-y-1.5 text-sm text-zinc-400">
                <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span><span>Uses TgStat API for advanced analytics</span></li>
                <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span><span>Requires API token (Settings → TgStat section)</span></li>
                <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span><span>Shows audience overlap, growth rate, engagement</span></li>
                <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span><span>Costs: balance-based (top up in Billing → Balance)</span></li>
                <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span><span className="text-emerald-300 font-medium">Best for competitive analysis & deep research</span></li>
              </ul>
            </div>
          </div>
        </div>
      }
      howTo={[
        'Go to "Group Search" in the sidebar',
        "Enter keywords describing your target audience (e.g., \"real estate Moscow\")",
        "Choose search mode: Free (default) or TgStat (if configured)",
        "Click \"Scan\" and wait for results",
        "Review found groups: name, member count, activity level",
        "Click \"Add\" next to each group to start monitoring",
      ]}
      expect={[
        "Free search: results within 5-30 seconds depending on keyword specificity",
        "TgStat search: richer data but costs balance credits",
        "Results include groups you haven't joined yet (public groups only)",
        "Add multiple groups at once for broader coverage",
      ]}
      tips="Start with Free search to test keywords. Switch to TgStat when you need engagement analytics or want to find high-value niche communities."
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
        "After adding groups, the scanner starts automatically",
        'Click "Start/Stop" to control the scanner manually',
        "The scanner reads messages from all monitored groups 24/7",
        "AI classifies each message as HOT/WARM/COLD based on your rules",
        "Qualified leads appear in the Leads pipeline in real-time",
      ]}
      expect={[
        "Scanner processes 100-500 messages/hour depending on group activity",
        "First leads appear within 24-48 hours of adding groups",
        "Auto-discover: system finds related groups via search_global",
        "Bulk import: upload CSV (username,first_name) or TXT (1 group/line)",
        "You can remove groups from monitoring at any time",
        "Both Telegram and VK groups are supported",
      ]}
      tips="Add 5-10 groups initially to test. Monitor for 1 week before scaling. Focus on groups with 1K-50K members for best lead quality."
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
            <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">Mailing Controls</h4>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="bg-emerald-500/10 rounded-lg p-3 text-center">
                <p className="text-emerald-400 font-medium">Start</p>
                <p className="text-zinc-500 text-xs">Begin sending</p>
              </div>
              <div className="bg-amber-500/10 rounded-lg p-3 text-center">
                <p className="text-amber-400 font-medium">Pause</p>
                <p className="text-zinc-500 text-xs">Temporarily stop</p>
              </div>
              <div className="bg-red-500/10 rounded-lg p-3 text-center">
                <p className="text-red-400 font-medium">Stop</p>
                <p className="text-zinc-500 text-xs">Cancel mailing</p>
              </div>
            </div>
          </div>
        </div>
      }
      howTo={[
        'Go to "Mailings" → "New Mailing"',
        "Write your message with variables: {first_name}, {group}",
        "Import recipients: upload CSV/TXT with usernames",
        "Or select recipients from your monitored groups",
        "Set sending schedule or send immediately",
        "Click Start — messages are sent across your accounts",
        "Monitor progress: sent, delivered, failed counts",
      ]}
      expect={[
        "Messages are distributed across accounts (5-20/day per account)",
        "Delivery stats update in real-time",
        "Failed messages are retried once, then logged as failed",
        "Pause stops sending; Resume continues from where it stopped",
      ]}
      warnings="Respect Telegram limits: 20-30 messages/day per account. Exceeding causes bans. The system enforces rate limits automatically."
      nextId="leads"
      nextLabel={t("wiki.nav.leads")}
      extra={
        <div className="space-y-4">
          <MockBrowser>
            <div className="space-y-1">
              <MockRow left="Welcome to {group}" right="1,247 sent • 89% delivered" status="active" />
              <MockRow left="Special offer for {name}" right="534 sent • 76% delivered" status="paused" />
            </div>
            <div className="mt-2 flex gap-2 text-[10px]">
              <div className="px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded">+ New Mailing</div>
              <div className="px-2 py-1 bg-zinc-700 text-zinc-400 rounded">Import Recipients</div>
            </div>
          </MockBrowser>
          <div className="space-y-3">
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
              <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">Available Variables</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                {[
                  ["{first_name}", "Recipient's first name"],
                  ["{group}", "Target group name"],
                  ["{username}", "Recipient's username"],
                  ["{city}", "City (if available)"],
                ].map(([v, d]) => (
                  <div key={v} className="flex items-center gap-2 text-zinc-400">
                    <code className="text-emerald-300 bg-zinc-900/50 px-1.5 py-0.5 rounded text-xs">{v}</code>
                    <span>{d}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
              <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">Anti-Spam Tips</h4>
              <ul className="space-y-1.5 text-sm text-zinc-400">
                <li className="flex items-start gap-2"><span className="text-amber-500 mt-0.5">•</span><span>Use spintax {"{hello|hi|hey}"} for message variation</span></li>
                <li className="flex items-start gap-2"><span className="text-amber-500 mt-0.5">•</span><span>Keep messages under 300 characters</span></li>
                <li className="flex items-start gap-2"><span className="text-amber-500 mt-0.5">•</span><span>Add delays between messages (built-in)</span></li>
                <li className="flex items-start gap-2"><span className="text-amber-500 mt-0.5">•</span><span>Never send identical messages to multiple groups</span></li>
              </ul>
            </div>
          </div>
        </div>
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
            <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">Lead Pipeline</h4>
            <div className="flex gap-2 flex-wrap">
              {[
                { label: "New", color: "bg-zinc-700 text-zinc-300", count: "89" },
                { label: "HOT", color: "bg-emerald-500/20 text-emerald-400", count: "12" },
                { label: "WARM", color: "bg-amber-500/20 text-amber-400", count: "34" },
                { label: "COLD", color: "bg-blue-500/20 text-blue-400", count: "43" },
                { label: "Contacted", color: "bg-violet-500/20 text-violet-400", count: "18" },
                { label: "Converted", color: "bg-emerald-500/40 text-emerald-300", count: "8" },
              ].map(({ label, color, count }) => (
                <div key={label} className={`px-2 py-1 text-[10px] rounded font-medium ${color}`}>{label} ({count})</div>
              ))}
            </div>
          </div>
        </div>
      }
      howTo={[
        "Leads appear automatically as the scanner finds them",
        'Click "Qualify" on any lead to run AI classification (HOT/WARM/COLD)',
        "Drag leads between pipeline stages (Kanban board)",
        "Import leads from CSV: upload file with username, message, source",
        "Export leads to CSV: click Export button, download spreadsheet",
        "Bulk update: select multiple leads, change status at once",
      ]}
      expect={[
        "Each lead shows: username, message, source group, timestamp, score",
        "AI qualification analyzes purchase intent, urgency, budget signals",
        "Lead detail view: full message history and audit trail",
        "Filters: by status, source group, date range, score",
      ]}
      nextId="rules"
      nextLabel={t("wiki.nav.rules")}
      extra={
        <MockBrowser>
          <div className="flex gap-2 mb-2">
            <div className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] rounded font-medium">HOT (12)</div>
            <div className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] rounded">WARM (34)</div>
            <div className="px-2 py-0.5 bg-zinc-700 text-zinc-400 text-[10px] rounded">COLD (89)</div>
          </div>
          <div className="space-y-1">
            <MockRow left="@alex_buyer" right="HOT • wants to rent • 2 min ago" status="new" />
            <MockRow left="@maria_invest" right="HOT • asking about price • 15 min ago" status="in_progress" />
            <MockRow left="@dmitry_seeker" right="WARM • comparing options • 1 hr ago" status="new" />
          </div>
          <div className="mt-2 flex gap-2 text-[10px]">
            <div className="px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded">Import CSV</div>
            <div className="px-2 py-1 bg-zinc-700 text-zinc-400 rounded">Export CSV</div>
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
            <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-3">Campaign Components</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="bg-zinc-900/50 rounded-lg p-3">
                <p className="text-emerald-400 font-medium mb-1">What to Post</p>
                <p className="text-zinc-400">Message text with spintax and variables</p>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-3">
                <p className="text-emerald-400 font-medium mb-1">How to Post</p>
                <p className="text-zinc-400">Variables: {"{first_name}"}, {"{group}"}, media URLs</p>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-3">
                <p className="text-emerald-400 font-medium mb-1">When to Post</p>
                <p className="text-zinc-400">Cron scheduling or manual run</p>
              </div>
            </div>
          </div>
        </div>
      }
      howTo={[
        'Go to "Campaigns" → "New Campaign"',
        "Write your message. Use spintax for variation: {hello|hi|hey} {name|friend}",
        "Add variables: {first_name} (recipient name), {group} (group name)",
        "Attach media: paste image/video URL or leave empty",
        "Set schedule: choose cron expression or \"Manual Only\"",
        'Click "Create" — campaign is ready',
        'Click "Run Now" for immediate execution, or wait for cron trigger',
      ]}
      expect={[
        "Campaign starts sending according to schedule",
        "Each message uses a different account (round-robin)",
        "Spintax generates unique variations — no duplicate messages",
        "Stats update in real-time: sent, delivered, failed",
      ]}
      nextId="autoReplies"
      nextLabel={t("wiki.nav.autoReplies")}
      extra={
        <div className="space-y-4">
          <MockBrowser>
            <div className="space-y-2">
              <MockRow left="Welcome {first_name}!" right="cron: 0 10 * * 1-5 • active" status="active" />
              <MockRow left="Special offer for {group}" right="cron: 0 18 * * * • active" status="active" />
              <MockRow left="New listing available" right="manual • last run: 2h ago" status="paused" />
            </div>
            <div className="mt-3 grid grid-cols-4 gap-1 text-center text-[10px]">
              <div className="bg-emerald-500/10 rounded py-1 text-emerald-400">Sent: 1,247</div>
              <div className="bg-blue-500/10 rounded py-1 text-blue-400">Delivered: 1,189</div>
              <div className="bg-amber-500/10 rounded py-1 text-amber-400">Pending: 23</div>
              <div className="bg-red-500/10 rounded py-1 text-red-400">Failed: 35</div>
            </div>
          </MockBrowser>
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
            <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">Cron Schedule Examples</h4>
            <div className="space-y-1.5 font-mono text-xs">
              <div className="flex items-center gap-3"><code className="text-emerald-300 bg-zinc-900/50 px-1.5 py-0.5 rounded">0 10 * * 1-5</code><span className="text-zinc-400">Mon-Fri at 10:00 AM</span></div>
              <div className="flex items-center gap-3"><code className="text-emerald-300 bg-zinc-900/50 px-1.5 py-0.5 rounded">*/30 * * * *</code><span className="text-zinc-400">Every 30 minutes</span></div>
              <div className="flex items-center gap-3"><code className="text-emerald-300 bg-zinc-900/50 px-1.5 py-0.5 rounded">0 9,18 * * *</code><span className="text-zinc-400">9 AM and 6 PM daily</span></div>
              <div className="flex items-center gap-3"><code className="text-emerald-300 bg-zinc-900/50 px-1.5 py-0.5 rounded">0 12 * * 0</code><span className="text-zinc-400">Sundays at noon</span></div>
            </div>
          </div>
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
            <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">A/B Testing</h4>
            <ul className="space-y-1.5 text-sm text-zinc-400">
              <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span><span>Create 2+ message variants in one campaign</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span><span>System sends random variant to each recipient</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span><span>Track which variant gets more responses</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span><span>Winner automatically used for remaining sends</span></li>
            </ul>
          </div>
          <Warning text="Respect rate limits: 5-20 messages/day per account. Exceeding causes Telegram bans. The system auto-distributes across accounts." />
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
              <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">Keyword Mode</h4>
              <ul className="space-y-1.5 text-sm text-zinc-400">
                <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span><span>Match keywords in incoming messages</span></li>
                <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span><span>Send predefined reply</span></li>
                <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span><span>Example: "price" → price list reply</span></li>
              </ul>
            </div>
            <div className="bg-zinc-800/50 border border-emerald-500/20 rounded-lg p-4">
              <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">AI Agent Mode</h4>
              <ul className="space-y-1.5 text-sm text-zinc-400">
                <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span><span>LLM generates natural responses</span></li>
                <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span><span>Requires API key in Settings</span></li>
                <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span><span>Best for complex conversations</span></li>
              </ul>
            </div>
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
              <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">Rotation Mode</h4>
              <ul className="space-y-1.5 text-sm text-zinc-400">
                <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span><span>Cycles through answer pool</span></li>
                <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span><span>Prevents repetitive responses</span></li>
                <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span><span>Good for FAQ-style replies</span></li>
              </ul>
            </div>
          </div>
        </div>
      }
      howTo={[
        'Go to "Auto-Replies" in the sidebar',
        'Click "New Auto-Reply" and select a mode (Keyword / AI / Rotation)',
        "For Keyword: enter trigger words and the reply for each",
        "For AI Agent: set system prompt and behavior guidelines",
        "For Rotation: add multiple answers, system picks the next one",
        "Assign to specific groups or all groups",
        "Toggle the auto-reply on/off with the switch",
      ]}
      expect={[
        "Incoming messages are checked against your rules instantly",
        "Keyword matches are immediate (< 1 second)",
        "AI responses take 2-5 seconds (depends on LLM provider)",
        "Rotation cycles through answers in order",
      ]}
      tips="Start with Keyword mode for common questions. Add AI Agent for complex queries. Use Rotation to keep responses fresh."
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
              <MockRow left="price / pricing / cost" right="→ Price list reply" status="active" />
              <MockRow left="hello / hi / hey" right="→ Welcome message" status="active" />
              <MockRow left="available / in stock" right="→ Availability check" status="active" />
            </div>
            <div className="mt-2 flex gap-2 text-[10px]">
              <div className="px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded">+ Add Rule</div>
              <div className="px-2 py-1 bg-zinc-700 text-zinc-400 rounded">Bulk Import</div>
            </div>
          </MockBrowser>
          <Tip text="Bulk import: upload a CSV/TXT file with keyword→reply pairs to quickly set up many auto-replies at once." />
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
            <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">Why Proxies Matter</h4>
            <ul className="space-y-1.5 text-sm text-zinc-400">
              <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span><span>Each Telegram account needs a unique IP address</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span><span>Without proxy, multiple accounts share one IP → ban</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span><span>Proxy location affects which groups you can access</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span><span>SOCKS5 recommended for best performance</span></li>
            </ul>
          </div>
        </div>
      }
      howTo={[
        'Go to "Settings" → "Proxies" or use the Proxies section',
        'Click "Add Proxy" — enter type, host, port, username, password',
        "For bulk import: paste one proxy per line (type://user:pass@host:port)",
        'Click "Test" to verify the proxy works before assigning',
        'Click "Auto-Assign" to randomly distribute proxies to accounts',
        "Assign proxy when creating a new account",
      ]}
      expect={[
        "Test shows: connection status, latency, geo location",
        "Auto-assign distributes proxies evenly across accounts",
        "Bulk import supports SOCKS5, HTTP, and HTTPS proxies",
      ]}
      tips="Buy proxies from a reliable provider. Use residential proxies for better success rates. Datacenter proxies work but have higher ban risk."
      nextId="settings"
      nextLabel={t("wiki.nav.settings")}
      extra={
        <div className="space-y-4">
          <MockBrowser>
            <div className="space-y-1">
              <MockRow left="socks5://user:pass@de.proxy.com:1080" right="Germany • 45ms • OK" status="active" />
              <MockRow left="socks5://user:pass@nl.proxy.com:1080" right="Netherlands • 62ms • OK" status="active" />
              <MockRow left="http://user:pass@us.proxy.com:8080" right="USA • 120ms • FAIL" status="error" />
            </div>
            <div className="mt-2 flex gap-2 text-[10px]">
              <div className="px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded">+ Add Proxy</div>
              <div className="px-2 py-1 bg-zinc-700 text-zinc-400 rounded">Bulk Import</div>
              <div className="px-2 py-1 bg-zinc-700 text-zinc-400 rounded">Auto-Assign</div>
            </div>
          </MockBrowser>
          <Warning text="CRITICAL: Never change a proxy on a connected account. This causes an immediate Telegram ban. 1 proxy = 1 account permanently." />
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
              { tab: "LLM", desc: "AI provider, API keys, model selection" },
              { tab: "Warmup", desc: "Account warmup schedule and parameters" },
              { tab: "Posting", desc: "Rate limits, message delays" },
              { tab: "Notifications", desc: "Email alerts, SMTP configuration" },
              { tab: "Auto-Reply", desc: "Global auto-reply behavior" },
              { tab: "Groups", desc: "Monitoring scanner settings" },
              { tab: "Webhooks", desc: "External integrations, test endpoints" },
              { tab: "Security", desc: "IP whitelist, two-factor auth" },
              { tab: "Data", desc: "Export data, delete account" },
              { tab: "Account", desc: "Profile, change password" },
            ].map(({ tab, desc }) => (
              <div key={tab} className="bg-zinc-900/50 rounded-lg p-3">
                <p className="text-emerald-400 font-medium text-sm mb-0.5">{tab}</p>
                <p className="text-zinc-500 text-xs">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      }
      howTo={[
        'Go to "Settings" in the sidebar',
        "Select the tab you want to configure",
        "Make changes — settings save automatically",
        "For Webhooks: click \"Test\" to verify connection",
        "For Data: click \"Export\" to download all your data as JSON",
      ]}
      expect={[
        "LLM settings affect AI classification and auto-reply quality",
        "Warmup settings control how new accounts build reputation",
        "Webhook test sends a ping to your endpoint",
        "Data export includes all leads, campaigns, groups, and settings",
      ]}
      nextId="billing"
      nextLabel={t("wiki.nav.billing")}
      extra={
        <MockBrowser>
          <div className="flex gap-1 mb-3 overflow-x-auto">
            {["LLM", "Warmup", "Posting", "Notifications", "Webhooks", "Security", "Data"].map((tab, i) => (
              <div key={tab} className={`px-2 py-1 text-[10px] rounded whitespace-nowrap ${i === 0 ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-700 text-zinc-400"}`}>{tab}</div>
            ))}
          </div>
          <div className="space-y-2">
            <MockRow left="LLM Provider" right="OpenRouter (gpt-4o-mini)" />
            <MockRow left="API Key" right="sk-or-v1-***...***" />
            <MockRow left="Warmup Duration" right="3-5 days" />
            <MockRow left="Max Messages/Day" right="15 per account" />
            <MockRow left="IP Whitelist" right="46.250.235.165" />
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

          {/* Plans comparison */}
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg overflow-hidden">
            <div className="grid grid-cols-4 gap-px bg-zinc-700">
              <div className="bg-zinc-800 p-3 text-xs font-semibold text-zinc-500">Plan</div>
              <div className="bg-zinc-800 p-3 text-xs font-semibold text-emerald-400 text-center">Starter</div>
              <div className="bg-zinc-800 p-3 text-xs font-semibold text-blue-400 text-center">Pro</div>
              <div className="bg-zinc-800 p-3 text-xs font-semibold text-amber-400 text-center">Enterprise</div>
              {[
                ["Price", "$75/mo", "$199/mo", "$499/mo"],
                ["Trial", "3 days", "3 days", "3 days"],
                ["TgStat", "—", "✓", "✓"],
                ["API Access", "—", "—", "✓"],
                ["Team Mgmt", "—", "✓", "✓"],
              ].map(([feat, s, p, e]) => (
                <div key={feat} className="contents">
                  <div className="bg-zinc-900/50 p-2 text-xs text-zinc-400">{feat}</div>
                  <div className="bg-zinc-900/50 p-2 text-xs text-zinc-300 text-center">{s}</div>
                  <div className="bg-zinc-900/50 p-2 text-xs text-zinc-300 text-center">{p}</div>
                  <div className="bg-zinc-900/50 p-2 text-xs text-zinc-300 text-center">{e}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Section access */}
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
            <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-3">Section Access by Plan</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-zinc-900/50 rounded-lg p-3">
                <p className="text-emerald-400 font-medium mb-2">Starter ($75)</p>
                <ul className="space-y-1 text-zinc-400">
                  <li>✓ Analytics</li>
                  <li>✓ Leads & Lead Rules</li>
                  <li>✓ Groups & Group Search (Free)</li>
                  <li>✓ Accounts & Proxies</li>
                  <li>✓ Campaigns & Mailings</li>
                  <li>✓ Auto-Replies</li>
                  <li>✓ Settings & Billing</li>
                  <li>✓ Help & How to Use</li>
                </ul>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-3">
                <p className="text-blue-400 font-medium mb-2">Pro ($199)</p>
                <ul className="space-y-1 text-zinc-400">
                  <li>✓ Everything in Starter</li>
                  <li>✓ Group Search (TgStat)</li>
                  <li>✓ Team Management</li>
                  <li>✓ Monitoring & Listeners</li>
                  <li className="text-zinc-600">✗ Blog (owner only)</li>
                  <li className="text-zinc-600">✗ Audit Log</li>
                  <li className="text-zinc-600">✗ Health Dashboard</li>
                </ul>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-3">
                <p className="text-amber-400 font-medium mb-2">Enterprise ($499)</p>
                <ul className="space-y-1 text-zinc-400">
                  <li>✓ Everything in Pro</li>
                  <li>✓ API Access (REST)</li>
                  <li>✓ Webhooks</li>
                  <li>✓ Custom Integrations</li>
                  <li className="text-zinc-600">✗ Blog (owner only)</li>
                  <li className="text-zinc-600">✗ Audit Log</li>
                  <li className="text-zinc-600">✗ Health Dashboard</li>
                </ul>
              </div>
            </div>
          </div>

          <Warning text="Blog section is available ONLY to the account owner (role: Owner). Managers and Agents cannot access it regardless of plan." />
        </div>
      }
      howTo={[
        'Go to "Billing" in the sidebar',
        "Start with 3-day free trial — full access to your plan features",
        "Choose a plan: Starter ($75), Pro ($199), or Enterprise ($499)",
        "Enter card details via Stripe or pay via YooKassa",
        "Payment is processed automatically each month",
        "Track usage and limits in the Billing dashboard",
      ]}
      expect={[
        "Trial gives full access to plan features for 3 days (no Blog)",
        "After trial, plan downgrades if no payment",
        "You can upgrade/downgrade plan anytime",
        "Usage resets each billing cycle",
      ]}
      nextId="team"
      nextLabel={t("wiki.nav.team")}
      extra={
        <div className="space-y-4">
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
            <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">Payment Methods</h4>
            <ul className="space-y-1.5 text-sm text-zinc-400">
              <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span><span><strong className="text-zinc-300">Stripe</strong> — Visa, Mastercard, Apple Pay, Google Pay</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span><span><strong className="text-zinc-300">YooKassa</strong> — Russian cards, Sberbank, SBP</span></li>
            </ul>
          </div>
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
            <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">Additional Costs (All Plans)</h4>
            <ul className="space-y-1.5 text-sm text-zinc-400">
              <li className="flex items-start gap-2"><span className="text-amber-500 mt-0.5">•</span><span><strong className="text-zinc-300">Telegram accounts</strong> — buy ready-made or use your own SIM cards (<a href={ACCOUNTS_BUY_LINK} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">sms-pro.guru</a>)</span></li>
              <li className="flex items-start gap-2"><span className="text-amber-500 mt-0.5">•</span><span><strong className="text-zinc-300">Proxies</strong> — SOCKS5/HTTP proxies required for each account (~$1-5/proxy/mo)</span></li>
              <li className="flex items-start gap-2"><span className="text-amber-500 mt-0.5">•</span><span><strong className="text-zinc-300">TgStat API</strong> — balance-based (Pro & Enterprise only), ~1-5 credits/query</span></li>
              <li className="flex items-start gap-2"><span className="text-amber-500 mt-0.5">•</span><span><strong className="text-zinc-300">LLM API</strong> — OpenRouter/OpenAI keys for AI classification (optional)</span></li>
            </ul>
          </div>
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
            <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">TgStat Search</h4>
            <ul className="space-y-1.5 text-sm text-zinc-400">
              <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span><span>Available on <strong className="text-zinc-300">Pro</strong> and <strong className="text-zinc-300">Enterprise</strong> plans only</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span><span>Requires API token from TgStat (Settings → TgStat)</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span><span>Top up balance in Billing → Balance section</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span><span>Free search (built-in) available on ALL plans</span></li>
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
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
            {t("wiki.subhead.forWhat")}
          </h3>
          <p className="text-sm text-zinc-300">{t("wiki.section.team.forWhat")}</p>
        </div>
        <div>
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Roles & Permissions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
              <p className="text-emerald-400 font-medium mb-1">Owner</p>
              <ul className="space-y-1 text-xs text-zinc-400">
                <li>• Full access to everything</li>
                <li>• Manage billing & subscriptions</li>
                <li>• Invite/remove users</li>
                <li>• Delete account</li>
              </ul>
            </div>
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
              <p className="text-blue-400 font-medium mb-1">Manager</p>
              <ul className="space-y-1 text-xs text-zinc-400">
                <li>• Manage campaigns & mailings</li>
                <li>• Manage leads & groups</li>
                <li>• View analytics</li>
                <li>• Cannot manage billing</li>
              </ul>
            </div>
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
              <p className="text-zinc-400 font-medium mb-1">Agent</p>
              <ul className="space-y-1 text-xs text-zinc-400">
                <li>• View leads only</li>
                <li>• Update lead status</li>
                <li>• Cannot create campaigns</li>
                <li>• Cannot manage settings</li>
              </ul>
            </div>
          </div>
        </div>
        <div>
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
            {t("wiki.subhead.howTo")}
          </h3>
          <StepList items={[
            'Go to "Team" in Settings',
            'Click "Invite User" — enter email and select role',
            "User receives invitation email with setup link",
            "To change role: click user → select new role",
            "To remove user: click user → Remove",
            "To change password: Account → Change Password",
            "Forgot password: click \"Forgot Password\" on login page",
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
