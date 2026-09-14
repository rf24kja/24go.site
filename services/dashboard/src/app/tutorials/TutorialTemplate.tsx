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
}

export default function TutorialTemplate({ title, description, prerequisites, steps, mistakes, results, canonical }: TutorialPageProps) {
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
          <Link href="/" className="text-lg font-bold tracking-tight">24<span className="text-emerald-400">GO</span></Link>
          <div className="flex items-center gap-3">
            <Suspense><LanguageSwitcher /></Suspense>
            <Link href="/login" className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition">Start Free Trial</Link>
          </div>
        </div>
      </header>

      <section className="py-16 px-6 lg:px-12 border-b border-zinc-800/50 bg-zinc-900/30">
        <div className="max-w-3xl mx-auto">
          <div className="inline-block px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-medium rounded-md border border-emerald-500/20 mb-4">Tutorial</div>
          <h1 className="text-4xl lg:text-5xl font-bold mb-4">{title}</h1>
          <p className="text-zinc-400 text-lg">{description}</p>
        </div>
      </section>

      <main className="max-w-3xl mx-auto px-6 py-12 space-y-12">
        {prerequisites.length > 0 && (
          <section>
            <h2 className="text-xl font-bold mb-4">Prerequisites</h2>
            <ul className="space-y-2">
              {prerequisites.map((p, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-zinc-400">
                  <span className="text-emerald-400">•</span> {p}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2 className="text-xl font-bold mb-6">Step-by-Step Guide</h2>
          <div className="space-y-8">
            {steps.map((s, i) => (
              <div key={i} className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-sm font-bold shrink-0">{i + 1}</div>
                <div>
                  <h3 className="font-bold mb-2">{s.title}</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">{s.content}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {mistakes.length > 0 && (
          <section>
            <h2 className="text-xl font-bold mb-4">Common Mistakes to Avoid</h2>
            <ul className="space-y-2">
              {mistakes.map((m, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-zinc-400">
                  <span className="text-rose-400">✗</span> {m}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2 className="text-xl font-bold mb-4">Expected Results</h2>
          <ul className="space-y-2">
            {results.map((r, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-zinc-300">
                <span className="text-emerald-400">✓</span> {r}
              </li>
            ))}
          </ul>
        </section>

        <section className="text-center pt-8 border-t border-zinc-800">
          <p className="text-zinc-400 mb-4">Want to automate this entirely?</p>
          <Link href="/login" className="inline-block px-8 py-3 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition">
            Start With 24GO →
          </Link>
        </section>
      </main>
    </div>
  );
}
