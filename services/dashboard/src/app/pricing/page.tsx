import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export const metadata: Metadata = {
  title: "Pricing — Lead Generation Plans for Telegram & VK",
  description: "Choose a plan for automated lead generation in Telegram and VK. Starter $25/mo, Pro $75/mo, Enterprise $300/mo. Full setup service available.",
  alternates: {
    canonical: "https://www.24go.site/pricing",
    languages: {
      en: "https://www.24go.site/pricing?locale=en",
      ru: "https://www.24go.site/pricing?locale=ru",
      "x-default": "https://www.24go.site/pricing",
    },
  },
  robots: { index: true, follow: true },
};

const plans = [
  {
    name: "Starter",
    price: "$25",
    period: "/mo",
    desc: "Core features for solo founders and small teams",
    features: [
      "Up to 10 accounts",
      "Analytics & Leads",
      "Target Groups",
      "Campaigns",
      "Auto-Replies",
      "Settings",
    ],
  },
  {
    name: "Pro",
    price: "$75",
    period: "/mo",
    desc: "Advanced features for growing teams",
    features: [
      "Everything in Starter",
      "TgStat Search",
      "Team Management",
      "Monitoring & Listeners",
      "Up to 50 accounts",
    ],
    popular: true,
  },
  {
    name: "Enterprise",
    price: "$300",
    period: "/mo",
    desc: "Unlimited access for agencies and large teams",
    features: [
      "Everything in Pro",
      "REST API Access",
      "Webhooks & Custom Integrations",
      "Unlimited accounts",
      "Priority Support",
    ],
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold tracking-tight">24<span className="text-emerald-400">GO</span></Link>
          <div className="flex items-center gap-3">
            <Suspense><LanguageSwitcher /></Suspense>
            <Link href="/login" className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition">Start Free Trial</Link>
          </div>
        </div>
      </header>
      <div className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h1 className="text-4xl lg:text-5xl font-bold mb-4">
            Simple, transparent <span className="text-emerald-400">pricing</span>
          </h1>
          <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
            Start generating leads in Telegram and VK. 3-day free trial on all plans.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`bg-zinc-900 border rounded-xl p-8 flex flex-col relative ${
                p.popular ? "border-emerald-500/40 ring-1 ring-emerald-500/20" : "border-zinc-800"
              }`}
            >
              {p.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                  POPULAR
                </span>
              )}
              <h3 className="text-zinc-100 font-medium text-lg">{p.name}</h3>
              <p className="text-xs text-zinc-500 mt-1">{p.desc}</p>
              <div className="mt-4 mb-6">
                <span className="text-4xl font-bold text-zinc-100">{p.price}</span>
                <span className="text-zinc-400 text-sm">{p.period}</span>
              </div>
              <ul className="space-y-3 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="text-zinc-400 text-sm flex items-center gap-2">
                    <span className="text-emerald-400">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/login"
                className={`mt-8 w-full py-3 rounded-lg text-sm font-medium text-center transition block ${
                  p.popular
                    ? "bg-emerald-500 text-white hover:bg-emerald-600"
                    : "bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
                }`}
              >
                Start Free Trial
              </Link>
            </div>
          ))}
        </div>

        {/* Service add-on */}
        <div className="mt-16 bg-zinc-900 border border-zinc-800 rounded-xl p-8">
          <h2 className="text-2xl font-bold mb-4">
            Full Setup & Campaign Curation <span className="text-emerald-400">Service</span>
          </h2>
          <p className="text-zinc-400 mb-6">
            Don&apos;t want to set up everything yourself? We&apos;ll configure your platform, create campaigns, and manage them for you.
          </p>
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="bg-zinc-800/50 rounded-lg p-6">
              <h3 className="font-semibold text-zinc-100 mb-2">Standard Service — $150/mo</h3>
              <p className="text-zinc-500 text-sm mb-3">For Starter & Pro plans</p>
              <ul className="space-y-2 text-zinc-400 text-sm">
                <li>✓ Full platform setup and configuration</li>
                <li>✓ Campaign creation and optimization</li>
                <li>✓ Ongoing curation and monitoring</li>
                <li>✓ Monthly performance reports</li>
              </ul>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-6">
              <h3 className="font-semibold text-zinc-100 mb-2">Enterprise Service — $1,000 one-time</h3>
              <p className="text-zinc-500 text-sm mb-3">For Enterprise plan</p>
              <ul className="space-y-2 text-zinc-400 text-sm">
                <li>✓ Complete platform setup from scratch</li>
                <li>✓ Custom integration development</li>
                <li>✓ Team training and onboarding</li>
                <li>✓ 30-day support included</li>
              </ul>
            </div>
          </div>
          <p className="text-zinc-600 text-sm mt-4">
            Contact <a href="mailto:rf24krsk@gmail.com" className="text-emerald-400 hover:underline">rf24krsk@gmail.com</a> to activate.
          </p>
        </div>

        <div className="mt-12 text-center">
          <Link href="/" className="text-zinc-500 hover:text-zinc-300 text-sm transition">
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
