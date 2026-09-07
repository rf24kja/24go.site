import type { Metadata } from "next";
import Link from "next/link";
import RoiCalculator from "./calculator";

export const metadata: Metadata = {
  title: "ROI Calculator — How Many Leads Can You Generate from Telegram? | 24GO",
  description:
    "Calculate your potential ROI from automated Telegram lead generation. Estimate leads, cost savings, and time saved with 24GO.",
  robots: "index, follow",
  alternates: {
    canonical: "https://www.24go.site/tools/roi-calculator",
  },
};

export default function RoiCalculatorPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Telegram Lead Generation ROI Calculator",
    url: "https://www.24go.site/tools/roi-calculator",
    description:
      "Free calculator to estimate ROI from automated Telegram lead generation.",
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
            Telegram Lead Generation{" "}
            <span className="text-emerald-400">ROI Calculator</span>
          </h1>
          <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
            Estimate how many leads you can generate, how much you&apos;ll save,
            and your return on investment with automated Telegram outreach.
          </p>
        </div>
      </section>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <RoiCalculator />

        <section className="mt-20 border-t border-zinc-800 pt-12">
          <h2 className="text-2xl font-bold mb-6">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            {faq.map((item, i) => (
              <details key={i} className="group">
                <summary className="cursor-pointer text-zinc-200 font-medium list-none flex items-center justify-between">
                  {item.q}
                  <span className="text-zinc-500 group-open:rotate-180 transition">
                    ▼
                  </span>
                </summary>
                <p className="text-zinc-400 mt-3 leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-16 text-center">
          <Link
            href="/login"
            className="inline-block px-8 py-3 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition"
          >
            Start Generating Leads →
          </Link>
        </section>
      </main>
    </div>
  );
}

const faq = [
  {
    q: "How many leads can I realistically generate per month?",
    a: "It depends on your niche and outreach volume. With 50 Telegram accounts sending 20 messages/day, you can reach 30,000 people monthly. At a 2-5% conversion rate, that's 600-1,500 qualified leads.",
  },
  {
    q: "What's the average conversion rate for Telegram outreach?",
    a: "Cold outreach typically converts at 1-3%. Warm leads from group engagement convert at 5-15%. AI-powered replies can double conversion by responding instantly when interest is highest.",
  },
  {
    q: "How does 24GO compare to hiring a sales team?",
    a: "A single SDR costs $3,000-5,000/month and can send 50-100 messages/day. 24GO starts at $75/month and can send 10,000+ messages/day across multiple accounts. That's 100x more outreach at 2-5% of the cost.",
  },
  {
    q: "Is Telegram outreach legal?",
    a: "Yes, when done responsibly. 24GO includes built-in rate limiting, work hours configuration, and opt-out handling to comply with anti-spam regulations. We recommend personalizing messages and targeting relevant audiences.",
  },
  {
    q: "How quickly can I see results?",
    a: "Most users see their first leads within 24-48 hours of setup. The warmup phase (7-14 days) improves deliverability, after which response rates increase significantly.",
  },
];
