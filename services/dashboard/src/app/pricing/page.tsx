import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

import { localizedPageMetadata } from "@/lib/public-metadata";

const pageMetadata: Metadata = {
  title: "Pricing — Lead Generation Plans for Telegram & VK",
  description: "Choose a plan for automated lead generation in Telegram and VK. Starter $25/mo, Pro $75/mo, Enterprise $300/mo. Full setup service available.",
  robots: { index: true, follow: true },
};

export function generateMetadata({ searchParams }: { searchParams?: { locale?: string } }): Metadata {
  return localizedPageMetadata("/pricing", searchParams?.locale, pageMetadata);
}

const plans = {
  en: [
    { name: "Starter", price: "$25", period: "/mo", desc: "Core features for solo founders and small teams", features: ["Up to 10 accounts", "Analytics & Leads", "Target Groups", "Campaigns", "Auto-Replies", "Settings"] },
    { name: "Pro", price: "$75", period: "/mo", desc: "Advanced features for growing teams", features: ["Everything in Starter", "TgStat Search", "Team Management", "Monitoring & Listeners", "Up to 50 accounts"], popular: true },
    { name: "Enterprise", price: "$300", period: "/mo", desc: "Unlimited access for agencies and large teams", features: ["Everything in Pro", "REST API Access", "Webhooks & Custom Integrations", "Unlimited accounts", "Priority Support"] },
  ],
  ru: [
    { name: "Starter", price: "$25", period: "/мес", desc: "Базовые функции для соло-предпринимателей и малых команд", features: ["До 10 аккаунтов", "Аналитика и лиды", "Целевые группы", "Кампании", "Автоответы", "Настройки"] },
    { name: "Pro", price: "$75", period: "/мес", desc: "Продвинутые функции для растущих команд", features: ["Всё из Starter", "TgStat поиск", "Управление командой", "Мониторинг и листенеры", "До 50 аккаунтов"], popular: true },
    { name: "Enterprise", price: "$300", period: "/мес", desc: "Без ограничений для агентств и крупных команд", features: ["Всё из Pro", "REST API доступ", "Вебхуки и кастомные интеграции", "Безлимитные аккаунты", "Приоритетная поддержка"] },
  ],
};

const t = {
  en: {
    title: "Simple, transparent ",
    titleAccent: "pricing",
    subtitle: "Start generating leads in Telegram and VK. 3-day free trial on all plans.",
    popular: "POPULAR",
    cta: "Start Free Trial",
    serviceTitle: "Full Setup & Campaign Curation ",
    serviceTitleAccent: "Service",
    serviceDesc: "Don't want to set up everything yourself? We'll configure your platform, create campaigns, and manage them for you.",
    standardTitle: "Standard Service — $150/mo",
    standardFor: "For Starter & Pro plans",
    standardItems: ["Full platform setup and configuration", "Campaign creation and optimization", "Ongoing curation and monitoring", "Monthly performance reports"],
    enterpriseTitle: "Enterprise Service — $1,000 one-time",
    enterpriseFor: "For Enterprise plan",
    enterpriseItems: ["Complete platform setup from scratch", "Custom integration development", "Team training and onboarding", "30-day support included"],
    contact: "Contact",
    contactAction: "to activate.",
    back: "← Back to home",
  },
  ru: {
    title: "Простые, прозрачные ",
    titleAccent: "тарифы",
    subtitle: "Начните генерировать лиды в Telegram и ВКонтакте. 3 дня бесплатно на всех тарифах.",
    popular: "ПОПУЛЯРНЫЙ",
    cta: "Попробовать бесплатно",
    serviceTitle: "Полная настройка и курирование ",
    serviceTitleAccent: "кампаний",
    serviceDesc: "Не хотите настраивать всё сами? Мы настроим платформу, создадим кампании и будем ими управлять.",
    standardTitle: "Стандартный сервис — $150/мес",
    standardFor: "Для тарифов Starter и Pro",
    standardItems: ["Полная настройка платформы", "Создание и оптимизация кампаний", "Курирование и мониторинг", "Ежемесячные отчёты"],
    enterpriseTitle: "Корпоративный сервис — $1 000 разово",
    enterpriseFor: "Для тарифа Enterprise",
    enterpriseItems: ["Полная настройка с нуля", "Разработка кастомных интеграций", "Обучение и онбординг команды", "30 дней поддержки"],
    contact: "Свяжитесь с",
    contactAction: "для активации.",
    back: "← На главную",
  },
};

export default async function PricingPage({ searchParams }: { searchParams: { locale?: string } }) {
  const locale = searchParams?.locale === "ru" ? "ru" : "en";
  const p = plans[locale];
  const c = t[locale];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href={`/?locale=${locale}`} className="text-lg font-bold tracking-tight">24<span className="text-emerald-400">GO</span></Link>
          <div className="flex items-center gap-3">
            <Suspense><LanguageSwitcher /></Suspense>
            <Link href="/login" className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition">{c.cta}</Link>
          </div>
        </div>
      </header>
      <div className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h1 className="text-4xl lg:text-5xl font-bold mb-4">
            {c.title}<span className="text-emerald-400">{c.titleAccent}</span>
          </h1>
          <p className="text-zinc-400 text-lg max-w-2xl mx-auto">{c.subtitle}</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {p.map((plan) => (
            <div key={plan.name} className={`bg-zinc-900 border rounded-xl p-8 flex flex-col relative ${plan.popular ? "border-emerald-500/40 ring-1 ring-emerald-500/20" : "border-zinc-800"}`}>
              {plan.popular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full">{c.popular}</span>}
              <h3 className="text-zinc-100 font-medium text-lg">{plan.name}</h3>
              <p className="text-xs text-zinc-500 mt-1">{plan.desc}</p>
              <div className="mt-4 mb-6">
                <span className="text-4xl font-bold text-zinc-100">{plan.price}</span>
                <span className="text-zinc-400 text-sm">{plan.period}</span>
              </div>
              <ul className="space-y-3 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="text-zinc-400 text-sm flex items-center gap-2"><span className="text-emerald-400">✓</span>{f}</li>
                ))}
              </ul>
              <Link href="/login" className={`mt-8 w-full py-3 rounded-lg text-sm font-medium text-center transition block ${plan.popular ? "bg-emerald-500 text-white hover:bg-emerald-600" : "bg-zinc-800 text-zinc-100 hover:bg-zinc-700"}`}>
                {c.cta}
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-16 bg-zinc-900 border border-zinc-800 rounded-xl p-8">
          <h2 className="text-2xl font-bold mb-4">{c.serviceTitle}<span className="text-emerald-400">{c.serviceTitleAccent}</span></h2>
          <p className="text-zinc-400 mb-6">{c.serviceDesc}</p>
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="bg-zinc-800/50 rounded-lg p-6">
              <h3 className="font-semibold text-zinc-100 mb-2">{c.standardTitle}</h3>
              <p className="text-zinc-500 text-sm mb-3">{c.standardFor}</p>
              <ul className="space-y-2 text-zinc-400 text-sm">{c.standardItems.map((i) => <li key={i}>✓ {i}</li>)}</ul>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-6">
              <h3 className="font-semibold text-zinc-100 mb-2">{c.enterpriseTitle}</h3>
              <p className="text-zinc-500 text-sm mb-3">{c.enterpriseFor}</p>
              <ul className="space-y-2 text-zinc-400 text-sm">{c.enterpriseItems.map((i) => <li key={i}>✓ {i}</li>)}</ul>
            </div>
          </div>
          <p className="text-zinc-600 text-sm mt-4">{c.contact} <a href="mailto:rf24krsk@gmail.com" className="text-emerald-400 hover:underline">rf24krsk@gmail.com</a> {c.contactAction}</p>
        </div>

        <div className="mt-12 text-center">
          <Link href={`/?locale=${locale}`} className="text-zinc-500 hover:text-zinc-300 text-sm transition">{c.back}</Link>
        </div>
      </div>
    </div>
  );
}
