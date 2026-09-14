import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Bot, Users, Send, Brain, BarChart3, Shield, Globe, Zap } from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export const metadata: Metadata = {
  title: "Features — AI-Powered Lead Generation from Telegram & VK",
  description: "Explore 24GO features: AI lead qualification, automated campaigns, multi-account management, anti-ban protection, analytics, and integrations.",
  alternates: {
    canonical: "https://www.24go.site/features",
    languages: {
      en: "https://www.24go.site/features?locale=en",
      ru: "https://www.24go.site/features?locale=ru",
      "x-default": "https://www.24go.site/features",
    },
  },
  robots: { index: true, follow: true },
};

const features = {
  en: [
    { icon: Users, title: "Target Group Discovery", desc: "Find and analyze Telegram groups where your prospects gather. Filter by member count, activity level, and topic relevance." },
    { icon: Brain, title: "AI Lead Qualification", desc: "Automatically score and classify leads as HOT/WARM/COLD using AI. Focus your time on the most promising prospects." },
    { icon: Send, title: "Automated Campaigns", desc: "Create personalized outreach campaigns with AI-generated messages. Anti-ban protection with rate limiting and content variation." },
    { icon: Bot, title: "Auto-Replies", desc: "Set up intelligent auto-responses that engage prospects 24/7. Keyword matching, AI-powered replies, and response rotation." },
    { icon: BarChart3, title: "Analytics Dashboard", desc: "Track response rates, lead quality, campaign performance, and ROI. Glassmorphism charts for real-time monitoring." },
    { icon: Shield, title: "Anti-Ban Protection", desc: "Built-in rate limiting, account warmup, proxy rotation, and content variation. Keep your accounts safe while scaling." },
    { icon: Globe, title: "Multi-Platform", desc: "Support for both Telegram and VKontakte. Manage all your outreach from a single dashboard." },
    { icon: Zap, title: "Integrations", desc: "Connect with AmoCRM, HubSpot, Google Sheets, webhooks, and more. Automate your entire sales pipeline." },
  ],
  ru: [
    { icon: Users, title: "Поиск целевых групп", desc: "Находите и анализируйте Telegram-группы, где собираются ваши потенциальные клиенты. Фильтрация по количеству участников, активности и тематике." },
    { icon: Brain, title: "AI-квалификация лидов", desc: "Автоматически оценивайте и классифицируйте лиды как HOT/WARM/COLD с помощью ИИ. Сосредоточьтесь на самых перспективных." },
    { icon: Send, title: "Автоматические кампании", desc: "Создавайте персонализированные кампании с сообщениями, сгенерированными ИИ. Защита от бана с ограничением скорости и вариацией контента." },
    { icon: Bot, title: "Автоответы", desc: "Настройте умные автоответы, которые работают 24/7. Сопоставление ключевых слов, ответы на основе ИИ и ротация." },
    { icon: BarChart3, title: "Дашборд аналитики", desc: "Отслеживайте rates ответов, качество лидов, эффективность кампаний и ROI. Графики для мониторинга в реальном времени." },
    { icon: Shield, title: "Защита от бана", desc: "Встроенные ограничение скорости, прогрев аккаунтов, ротация прокси и вариация контента. Безопасное масштабирование." },
    { icon: Globe, title: "Мультиплатформенность", desc: "Поддержка Telegram и ВКонтакте. Управляйте всеми кампаниями из одного дашборда." },
    { icon: Zap, title: "Интеграции", desc: "Подключение к AmoCRM, HubSpot, Google Sheets, вебхукам и другим системам. Автоматизация всего воронки продаж." },
  ],
};

const t = {
  en: {
    title: "Everything you need for ", titleAccent: "lead generation",
    subtitle: "AI-powered platform for automated lead generation in Telegram and VKontakte. From finding prospects to closing deals.",
    howTitle: "How it works",
    steps: [
      { step: "1", title: "Connect Accounts", desc: "Add your Telegram or VK accounts" },
      { step: "2", title: "Add Target Groups", desc: "Find groups where your prospects gather" },
      { step: "3", title: "Create Campaign", desc: "Set up AI-powered personalized outreach" },
      { step: "4", title: "Get Leads", desc: "Receive qualified leads on autopilot" },
    ],
    ctaTitle: "Ready to start generating leads?",
    ctaSubtitle: "3-day free trial. No credit card required.",
    cta: "Start Free Trial",
    back: "← Back to home",
  },
  ru: {
    title: "Всё для ", titleAccent: "лидогенерации",
    subtitle: "Платформа на основе ИИ для автоматической лидогенерации в Telegram и ВКонтакте. От поиска клиентов до закрытия сделок.",
    howTitle: "Как это работает",
    steps: [
      { step: "1", title: "Подключите аккаунты", desc: "Добавьте ваши аккаунты Telegram или ВК" },
      { step: "2", title: "Добавьте группы", desc: "Найдите группы, где собираются ваши клиенты" },
      { step: "3", title: "Создайте кампанию", desc: "Настройте персонализированный охват с ИИ" },
      { step: "4", title: "Получайте лиды", desc: "Получайте квалифицированных лидов автоматически" },
    ],
    ctaTitle: "Готовы начать генерировать лиды?",
    ctaSubtitle: "3 дня бесплатно. Без привязки карты.",
    cta: "Попробовать бесплатно",
    back: "← На главную",
  },
};

export default async function FeaturesPage({ searchParams }: { searchParams: { locale?: string } }) {
  const locale = searchParams?.locale === "ru" ? "ru" : "en";
  const f = features[locale];
  const c = t[locale];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold tracking-tight">24<span className="text-emerald-400">GO</span></Link>
          <div className="flex items-center gap-3">
            <Suspense><LanguageSwitcher /></Suspense>
            <Link href="/login" className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition">{c.cta}</Link>
          </div>
        </div>
      </header>
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h1 className="text-4xl lg:text-5xl font-bold mb-4">
            {c.title}<span className="text-emerald-400">{c.titleAccent}</span>
          </h1>
          <p className="text-zinc-400 text-lg max-w-2xl mx-auto">{c.subtitle}</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {f.map((feat) => (
            <div key={feat.title} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 hover:border-zinc-700 transition">
              <feat.icon className="w-8 h-8 text-emerald-400 mb-4" />
              <h3 className="text-zinc-100 font-semibold mb-2">{feat.title}</h3>
              <p className="text-zinc-500 text-sm leading-relaxed">{feat.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-24">
          <h2 className="text-3xl font-bold text-center mb-12">{c.howTitle}</h2>
          <div className="grid md:grid-cols-4 gap-8">
            {c.steps.map((s) => (
              <div key={s.step} className="text-center">
                <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-emerald-400 font-bold text-lg">{s.step}</span>
                </div>
                <h3 className="text-zinc-100 font-semibold mb-1">{s.title}</h3>
                <p className="text-zinc-500 text-sm">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-24 text-center">
          <h2 className="text-3xl font-bold mb-4">{c.ctaTitle}</h2>
          <p className="text-zinc-400 mb-8">{c.ctaSubtitle}</p>
          <Link href="/login" className="inline-block px-8 py-3 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition shadow-lg shadow-emerald-500/20">{c.cta}</Link>
        </div>

        <div className="mt-12 text-center">
          <Link href="/" className="text-zinc-500 hover:text-zinc-300 text-sm transition">{c.back}</Link>
        </div>
      </div>
    </div>
  );
}
