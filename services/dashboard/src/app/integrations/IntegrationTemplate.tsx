import Link from "next/link";
import { Suspense } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

interface IntegrationPageProps {
  name: string;
  description: string;
  features: string[];
  steps: { title: string; desc: string }[];
  faq: { q: string; a: string }[];
  canonical: string;
  locale?: string;
}

const labels = {
  en: { badge: "Integration", howItWorks: "How It Works", features: "Features", faq: "FAQ", cta: "Start Connecting Telegram to" },
  ru: { badge: "Интеграция", howItWorks: "Как это работает", features: "Возможности", faq: "Вопросы и ответы", cta: "Начать подключение Telegram к" },
};

export default function IntegrationTemplate({ name, description, features, steps, faq, canonical, locale = "en" }: IntegrationPageProps) {
  const l = labels[locale === "ru" ? "ru" : "en"];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `Telegram → ${name} Integration`,
    description,
    url: canonical,
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href={`/?locale=${locale}`} className="text-lg font-bold tracking-tight">24<span className="text-emerald-400">GO</span></Link>
          <div className="flex items-center gap-3">
            <Suspense><LanguageSwitcher /></Suspense>
            <Link href="/login" className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition">{locale === "ru" ? "Попробовать бесплатно" : "Start Free Trial"}</Link>
          </div>
        </div>
      </header>

      <section className="py-16 px-6 lg:px-12 border-b border-zinc-800/50 bg-zinc-900/30">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-block px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-medium rounded-md border border-emerald-500/20 mb-4">{l.badge}</div>
          <h1 className="text-4xl lg:text-5xl font-bold mb-4">Telegram → <span className="text-emerald-400">{name}</span></h1>
          <p className="text-zinc-400 text-lg max-w-2xl mx-auto">{description}</p>
        </div>
      </section>

      <main className="max-w-3xl mx-auto px-6 py-12 space-y-16">
        <section>
          <h2 className="text-2xl font-bold mb-6">{l.howItWorks}</h2>
          <div className="space-y-4">
            {steps.map((s, i) => (
              <div key={i} className="flex gap-4 items-start">
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-sm font-bold shrink-0">{i + 1}</div>
                <div>
                  <h3 className="font-bold mb-1">{s.title}</h3>
                  <p className="text-sm text-zinc-400">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-6">{l.features}</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {features.map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-zinc-300">
                <span className="text-emerald-400">✓</span> {f}
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-6">{l.faq}</h2>
          <div className="space-y-4">
            {faq.map((item, i) => (
              <details key={i} className="group">
                <summary className="cursor-pointer text-zinc-200 font-medium list-none flex items-center justify-between">
                  {item.q}
                  <span className="text-zinc-500 group-open:rotate-180 transition">▼</span>
                </summary>
                <p className="text-zinc-400 mt-3 leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="text-center">
          <Link href="/login" className="inline-block px-8 py-3 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition">
            {l.cta} {name} →
          </Link>
        </section>
      </main>
    </div>
  );
}
