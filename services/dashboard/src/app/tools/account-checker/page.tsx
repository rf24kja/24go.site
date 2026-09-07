import type { Metadata } from "next";
import Link from "next/link";
import AccountChecker from "./checker";

export const metadata: Metadata = {
  title: "Telegram Account Health Checker — Is Your Account Ready for Mass Outreach? | 24GO",
  description:
    "Check if your Telegram account is ready for automated lead generation. Free health assessment with personalized recommendations.",
  robots: "index, follow",
  alternates: {
    canonical: "https://www.24go.site/tools/account-checker",
  },
};

export default function AccountCheckerPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Telegram Account Health Checker",
    url: "https://www.24go.site/tools/account-checker",
    description: "Free tool to check if your Telegram account is ready for mass outreach.",
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
            Account Health{" "}
            <span className="text-emerald-400">Checker</span>
          </h1>
          <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
            Answer 8 quick questions to find out if your Telegram account is
            ready for automated lead generation.
          </p>
        </div>
      </section>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <AccountChecker />

        <section className="mt-16 text-center">
          <Link
            href="/login"
            className="inline-block px-8 py-3 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition"
          >
            Start With Healthy Accounts →
          </Link>
        </section>
      </main>
    </div>
  );
}
