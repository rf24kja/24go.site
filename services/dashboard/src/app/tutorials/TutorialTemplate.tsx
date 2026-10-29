import Link from "next/link";
import { Suspense } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

interface TutorialPageProps {
  title: string;
  description: string;
  prerequisites: string[];
  steps: { title: string; content: string }[];
  mistakes: string[];
  results: string[];
  canonical: string;
  locale?: string;
}

const labels = {
  en: { badge: "Tutorial", prereq: "Prerequisites", steps: "Step-by-Step Guide", mistakes: "Common Mistakes", results: "Expected Results", cta: "Start Auto-Reply Setup", back: "← Back to all tutorials" },
  ru: { badge: "Туториал", prereq: "Что нужно", steps: "Пошаговое руководство", mistakes: "Типичные ошибки", results: "Ожидаемые результаты", cta: "Начать настройку автоответов", back: "← Ко всем туториалам" },
};

export default function TutorialTemplate({ title, description, prerequisites, steps, mistakes, results, canonical, locale = "en" }: TutorialPageProps) {
  const l = labels[locale === "ru" ? "ru" : "en"];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    name: title,
    description,
    url: canonical,
    author: { "@type": "Organization", name: "24GO" },
    publisher: { "@type": "Organization", name: "24GO" },
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
        <div className="max-w-3xl mx-auto">
          <div className="inline-block px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-medium rounded-md border border-emerald-500/20 mb-4">{l.badge}</div>
          <h1 className="text-4xl lg:text-5xl font-bold mb-4">{title}</h1>
          <p className="text-zinc-400 text-lg">{description}</p>
        </div>
      </section>

      <main className="max-w-3xl mx-auto px-6 py-12 space-y-16">
        <section>
          <h2 className="text-2xl font-bold mb-6">{l.prereq}</h2>
          <ul className="space-y-2 text-zinc-400">
            {prerequisites.map((p, i) => <li key={i} className="flex items-center gap-2"><span className="text-emerald-400">✓</span> {p}</li>)}
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-6">{l.steps}</h2>
          <div className="space-y-6">
            {steps.map((s, i) => (
              <div key={i} className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-sm font-bold shrink-0">{i + 1}</div>
                <div>
                  <h3 className="font-bold mb-2">{s.title}</h3>
                  <div className="text-zinc-400 text-sm leading-relaxed whitespace-pre-line">{s.content}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-6">{l.mistakes}</h2>
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-6">
            <ul className="space-y-2 text-zinc-400">
              {mistakes.map((m, i) => <li key={i}>⚠ {m}</li>)}
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-6">{l.results}</h2>
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-6">
            <ul className="space-y-2 text-zinc-400">
              {results.map((r, i) => <li key={i}>✓ {r}</li>)}
            </ul>
          </div>
        </section>

        <section className="text-center pt-8 border-t border-zinc-800">
          <Link href="/login" className="inline-block px-8 py-3 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition mb-4">{l.cta}</Link>
          <p><Link href={`/tools?locale=${locale}`} className="text-zinc-500 hover:text-zinc-300 text-sm transition">{l.back}</Link></p>
        </section>
      </main>
    </div>
  );
}
