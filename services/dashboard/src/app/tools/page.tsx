import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Calculator, Search, Shield, Plug, BookOpen } from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export const metadata: Metadata = {
  title: "Free Telegram Marketing Tools — ROI Calculator, Group Analyzer, Account Checker | 24GO",
  description: "Free tools for Telegram marketers: ROI calculator, group analyzer, account health checker, integration guides, and step-by-step tutorials.",
  robots: "index, follow",
  alternates: {
    canonical: "https://www.24go.site/tools",
    languages: {
      en: "https://www.24go.site/tools?locale=en",
      ru: "https://www.24go.site/tools?locale=ru",
      "x-default": "https://www.24go.site/tools",
    },
  },
};

const tools = [
  {
    icon: Calculator,
    title: "ROI Calculator",
    desc: "Estimate your potential leads, cost savings, and return on investment from automated Telegram outreach.",
    href: "/tools/roi-calculator",
    color: "text-emerald-400",
  },
  {
    icon: Search,
    title: "Group Analyzer",
    desc: "Analyze any public Telegram group: member count, activity level, and lead generation potential.",
    href: "/tools/group-analyzer",
    color: "text-blue-400",
  },
  {
    icon: Shield,
    title: "Account Health Checker",
    desc: "Check if your Telegram account is ready for automated lead generation with our free assessment.",
    href: "/tools/account-checker",
    color: "text-yellow-400",
  },
];

const integrations = [
  { name: "AmoCRM", href: "/integrations/amo-crm" },
  { name: "Google Sheets", href: "/integrations/google-sheets" },
  { name: "HubSpot", href: "/integrations/hubspot" },
  { name: "Bitrix24", href: "/integrations/bitrix24" },
  { name: "Webhooks (Any System)", href: "/integrations/webhook" },
];

const tutorials = [
  { title: "Telegram Auto-Reply Setup", href: "/tutorials/telegram-auto-reply" },
  { title: "Telegram Lead Scraping", href: "/tutorials/telegram-lead-scraping" },
  { title: "Telegram Account Warmup", href: "/tutorials/telegram-warmup" },
];

export default function ToolsPage() {
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

      <section className="py-16 px-6 lg:px-12 border-b border-zinc-800/50 bg-zinc-900/30">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl lg:text-5xl font-bold mb-4">Free <span className="text-emerald-400">Telegram Marketing</span> Tools</h1>
          <p className="text-zinc-400 text-lg">Calculators, analyzers, guides, and tutorials to help you generate more leads from Telegram.</p>
        </div>
      </section>

      <main className="max-w-5xl mx-auto px-6 py-12 space-y-16">
        <section>
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><Calculator className="w-6 h-6 text-emerald-400" /> Free Tools</h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {tools.map((tool) => (
              <Link key={tool.href} href={tool.href} className="group block bg-zinc-900 border border-zinc-800 rounded-2xl p-6 hover:border-zinc-700 hover:bg-zinc-800/50 transition-all">
                <tool.icon className={`w-8 h-8 ${tool.color} mb-3`} />
                <h3 className="font-bold mb-2 group-hover:text-emerald-400 transition">{tool.title}</h3>
                <p className="text-sm text-zinc-500">{tool.desc}</p>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><Plug className="w-6 h-6 text-emerald-400" /> Integrations</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {integrations.map((int) => (
              <Link key={int.href} href={int.href} className="block bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition text-center font-medium text-zinc-300 hover:text-emerald-400">
                {int.name}
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><BookOpen className="w-6 h-6 text-emerald-400" /> Tutorials</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {tutorials.map((tut) => (
              <Link key={tut.href} href={tut.href} className="block bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition text-center font-medium text-zinc-300 hover:text-emerald-400">
                {tut.title}
              </Link>
            ))}
          </div>
        </section>

        <section className="text-center pt-8 border-t border-zinc-800">
          <h2 className="text-2xl font-bold mb-4">Ready for more than free tools?</h2>
          <p className="text-zinc-400 mb-6">24GO automates the entire lead generation pipeline — from scraping to outreach to CRM sync.</p>
          <Link href="/login" className="inline-block px-8 py-3 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition">
            Start Free Trial →
          </Link>
        </section>
      </main>
    </div>
  );
}
