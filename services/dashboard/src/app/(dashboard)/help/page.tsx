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

function ScreenshotPlaceholder({ title, hint }: { title: string; hint?: string }) {
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
      <div className="relative aspect-[16/9] flex items-center justify-center bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950">
        <div className="text-center space-y-2 px-6">
          <div className="text-sm font-medium text-zinc-400">{title}</div>
          {hint && <div className="text-xs text-zinc-600">{hint}</div>}
        </div>
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
  screenshot,
  screenshotHint,
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
  screenshot?: string;
  screenshotHint?: string;
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

      {screenshot && (
        <div className="mb-6">
          <ScreenshotPlaceholder title={screenshot} hint={screenshotHint} />
        </div>
      )}

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
      screenshot="Platform Dashboard Overview"
      screenshotHint="Main dashboard with analytics, leads, and campaign stats"
    />
  );
}

function AccountsSection({ t }: { t: (k: string) => string }) {
  return (
    <Section
      id="accounts"
      icon={Users}
      title={t("wiki.section.accounts.title")}
      forWhat={t("wiki.section.accounts.forWhat")}
      howTo={t("wiki.section.accounts.howTo").split("\n")}
      expect={t("wiki.section.accounts.expect").split("\n")}
      tips={t("wiki.section.accounts.tip")}
      warnings={t("wiki.section.accounts.warning")}
      extra={
        <div className="space-y-4">
          <ScreenshotPlaceholder title="Accounts Management" hint="Add, connect, and manage Telegram accounts" />
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
      forWhat={t("wiki.section.search.forWhat")}
      howTo={t("wiki.section.search.howTo").split("\n")}
      expect={t("wiki.section.search.expect").split("\n")}
      tips={t("wiki.section.search.tip")}
      screenshot="Group Search Interface"
      screenshotHint="Search Telegram groups by keyword, geo, and niche"
      nextId="monitoring"
      nextLabel={t("wiki.nav.monitoring")}
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
      howTo={t("wiki.section.monitoring.howTo").split("\n")}
      expect={t("wiki.section.monitoring.expect").split("\n")}
      tips={t("wiki.section.monitoring.tip")}
      screenshot="Group Monitoring Dashboard"
      screenshotHint="Track scanning status, leads found, and group activity"
      extra={
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
      }
      nextId="mailings"
      nextLabel={t("wiki.nav.mailings")}
    />
  );
}

function MailingsSection({ t }: { t: (k: string) => string }) {
  return (
    <Section
      id="mailings"
      icon={Send}
      title={t("wiki.section.mailings.title")}
      forWhat={t("wiki.section.mailings.forWhat")}
      howTo={t("wiki.section.mailings.howTo").split("\n")}
      expect={t("wiki.section.mailings.expect").split("\n")}
      warnings={t("wiki.section.mailings.warning")}
      screenshot="Mailing Campaign Manager"
      screenshotHint="Create, send, and track bulk message campaigns"
      extra={
        <div className="space-y-3">
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
            <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">
              {t("wiki.subhead.variables") || "Available Variables"}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              {t("wiki.section.mailings.variables").split("\n").map((line, i) => (
                <div key={i} className="flex items-center gap-2 text-zinc-400">
                  <code className="text-emerald-300 bg-zinc-900/50 px-1.5 py-0.5 rounded text-xs">{line.split(" — ")[0]}</code>
                  <span>{line.split(" — ")[1] || ""}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
            <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">
              {t("wiki.subhead.antiSpam") || "Anti-Spam Tips"}
            </h4>
            <ul className="space-y-1.5 text-sm text-zinc-400">
              {t("wiki.section.mailings.antiSpam").split("\n").map((line, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">•</span>
                  <span>{line.replace(/^•\s*/, "")}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      }
      nextId="leads"
      nextLabel={t("wiki.nav.leads")}
    />
  );
}

function LeadsSection({ t }: { t: (k: string) => string }) {
  return (
    <Section
      id="leads"
      icon={UserCheck}
      title={t("wiki.section.leads.title")}
      forWhat={t("wiki.section.leads.forWhat")}
      howTo={t("wiki.section.leads.howTo").split("\n")}
      expect={t("wiki.section.leads.expect").split("\n")}
      screenshot="Lead Management Pipeline"
      screenshotHint="View, filter, and qualify leads by intent score"
      nextId="rules"
      nextLabel={t("wiki.nav.rules")}
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
      screenshot="Lead Scoring Rules"
      screenshotHint="Configure keyword-based rules for automatic lead classification"
      extra={
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
      }
      nextId="campaigns"
      nextLabel={t("wiki.nav.campaigns")}
    />
  );
}

function CampaignsSection({ t }: { t: (k: string) => string }) {
  return (
    <Section
      id="campaigns"
      icon={Megaphone}
      title={t("wiki.section.campaigns.title")}
      forWhat={t("wiki.section.campaigns.forWhat")}
      howTo={t("wiki.section.campaigns.howTo").split("\n")}
      expect={t("wiki.section.campaigns.expect").split("\n")}
      nextId="autoReplies"
      nextLabel={t("wiki.nav.autoReplies")}
    />
  );
}

function AutoRepliesSection({ t }: { t: (k: string) => string }) {
  return (
    <Section
      id="autoReplies"
      icon={MessageSquare}
      title={t("wiki.section.autoReplies.title")}
      forWhat={t("wiki.section.autoReplies.forWhat")}
      howTo={t("wiki.section.autoReplies.howTo").split("\n")}
      expect={t("wiki.section.autoReplies.expect").split("\n")}
      tips={t("wiki.section.autoReplies.tip")}
      nextId="proxies"
      nextLabel={t("wiki.nav.proxies")}
    />
  );
}

function ProxiesSection({ t }: { t: (k: string) => string }) {
  return (
    <Section
      id="proxies"
      icon={Shield}
      title={t("wiki.section.proxies.title")}
      forWhat={t("wiki.section.proxies.forWhat")}
      howTo={t("wiki.section.proxies.howTo").split("\n")}
      expect={t("wiki.section.proxies.expect").split("\n")}
      tips={t("wiki.section.proxies.tip")}
      nextId="settings"
      nextLabel={t("wiki.nav.settings")}
    />
  );
}

function SettingsSection({ t }: { t: (k: string) => string }) {
  return (
    <Section
      id="settings"
      icon={Settings}
      title={t("wiki.section.settings.title")}
      forWhat={t("wiki.section.settings.forWhat")}
      howTo={t("wiki.section.settings.howTo").split("\n")}
      expect={t("wiki.section.settings.expect").split("\n")}
      tips={t("wiki.section.settings.tip")}
      nextId="billing"
      nextLabel={t("wiki.nav.billing")}
    />
  );
}

function BillingSection({ t }: { t: (k: string) => string }) {
  return (
    <Section
      id="billing"
      icon={CreditCard}
      title={t("wiki.section.billing.title")}
      forWhat={t("wiki.section.billing.forWhat")}
      howTo={t("wiki.section.billing.howTo").split("\n")}
      expect={t("wiki.section.billing.expect").split("\n")}
      nextId="team"
      nextLabel={t("wiki.nav.team")}
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
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
            {t("wiki.subhead.howTo")}
          </h3>
          <StepList items={t("wiki.section.team.howTo").split("\n")} />
        </div>
        <div>
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
            {t("wiki.subhead.roles")}
          </h3>
          <ExpectList items={t("wiki.section.team.expect").split("\n")} />
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
