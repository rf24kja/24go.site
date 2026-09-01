"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";

const STEPS = [
  { num: 1, href: "/billing", icon: "💳", key: "register" },
  { num: 2, href: "/accounts", icon: "🔗", key: "connectTg" },
  { num: 3, href: "/targets", icon: "🎯", key: "discoverTargets" },
  { num: 4, href: "/scoring", icon: "⚙️", key: "scoring" },
  { num: 5, href: null, icon: "📡", key: "listener" },
  { num: 6, href: "/campaigns", icon: "📣", key: "campaign" },
  { num: 7, href: "/leads", icon: "📊", key: "leads" },
  { num: 8, href: "/settings", icon: "🤖", key: "autoReply" },
  { num: 9, href: "/settings", icon: "🔗", key: "webhooks" },
];

const FAQ = [
  "faqTrial",
  "faqAccounts",
  "faqWarmup",
  "faqLeads",
  "faqAI",
  "faqBilling",
  "faqTelegram",
  "faqLimits",
];

export default function HelpPage() {
  const { t } = useI18n();

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-slide-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">{t("help.title")}</h1>
        <p className="text-zinc-400 mt-1">{t("help.subtitle")}</p>
      </div>

      {/* Steps */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-200">{t("help.quickStart")}</h2>
        {STEPS.map((step) => (
          <div key={step.num} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-sm">
                {step.num}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-zinc-100 font-medium flex items-center gap-2">
                  <span>{step.icon}</span>
                  {t(`help.step${step.num}.title`)}
                </h3>
                <p className="text-zinc-400 text-sm mt-1">
                  {t(`help.step${step.num}.desc`)}
                </p>
                <div className="mt-3 bg-zinc-950 rounded-lg p-3 text-sm text-zinc-300 space-y-1">
                  {t(`help.step${step.num}.details`)
                    .split("\n")
                    .map((line: string, i: number) => (
                      <p key={i}>{line}</p>
                    ))}
                </div>
                {step.href && (
                  <Link
                    href={step.href}
                    className="inline-block mt-3 px-4 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-medium hover:bg-emerald-500/20 transition"
                  >
                    {t("help.goTo")} →
                  </Link>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tips */}
      <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-emerald-400 mb-3">{t("help.tipsTitle")}</h2>
        <ul className="space-y-2 text-sm text-zinc-300">
          {[1, 2, 3, 4, 5].map((i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">✓</span>
              <span>{t(`help.tip${i}`)}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* FAQ */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-zinc-200">{t("help.faqTitle")}</h2>
        {FAQ.map((key) => (
          <details key={key} className="bg-zinc-900 border border-zinc-800 rounded-xl group">
            <summary className="p-4 cursor-pointer text-zinc-200 font-medium text-sm hover:text-zinc-100 transition list-none flex items-center justify-between">
              {t(`help.${key}.q`)}
              <span className="text-zinc-500 group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="px-4 pb-4 text-sm text-zinc-400 leading-relaxed">
              {t(`help.${key}.a`)}
            </div>
          </details>
        ))}
      </div>

      {/* Support */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 text-center">
        <p className="text-zinc-400 text-sm">{t("help.support")}</p>
        <a
          href="mailto:support@24go.site"
          className="text-emerald-400 text-sm font-medium hover:underline mt-1 inline-block"
        >
          support@24go.site
        </a>
      </div>
    </div>
  );
}
