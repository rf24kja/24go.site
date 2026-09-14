import type { Metadata } from "next";
import Link from "next/link";
import GroupAnalyzer from "./analyzer";

export const metadata: Metadata = {
  title: "Free Telegram Group Analyzer — Check Members, Activity & Lead Potential | 24GO",
  description:
    "Analyze any public Telegram group: member count, activity level, and lead generation potential. Free tool by 24GO.",
  robots: "index, follow",
  alternates: {
    canonical: "https://www.24go.site/tools/group-analyzer",
    languages: {
      en: "https://www.24go.site/tools/group-analyzer?locale=en",
      ru: "https://www.24go.site/tools/group-analyzer?locale=ru",
      "x-default": "https://www.24go.site/tools/group-analyzer",
    },
  },
};

export default function GroupAnalyzerPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Telegram Group Analyzer",
    url: "https://www.24go.site/tools/group-analyzer",
    description: "Free tool to analyze Telegram groups for lead generation potential.",
    applicationCategory: "BusinessApplication",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold tracking-tight">
            24<span className="text-emerald-400">GO</span>
          </Link>
          <Link
            href="/login"
            className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition"
          >
            Start Free Trial
          </Link>
        </div>
      </header>

      <section className="py-16 px-6 lg:px-12 border-b border-zinc-800/50 bg-zinc-900/30">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl lg:text-5xl font-bold mb-4">
            Telegram Group{" "}
            <span className="text-emerald-400">Analyzer</span>
          </h1>
          <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
            Paste a Telegram group link to get instant insights: member count,
            activity level, and lead generation potential.
          </p>
        </div>
      </section>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <GroupAnalyzer />

        <section className="mt-16 text-center">
          <Link
            href="/login"
            className="inline-block px-8 py-3 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition"
          >
            Start Auto-Scraping Groups →
          </Link>
        </section>
      </main>
    </div>
  );
}
