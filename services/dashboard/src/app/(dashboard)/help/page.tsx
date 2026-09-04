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
  { id: "billing", icon: CreditCard, labelKey: "wiki.nav.billing" },
  { id: "team", icon: UserCog, labelKey: "wiki.nav.team" },
];

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
