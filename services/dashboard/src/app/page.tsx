import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "24GO — Lead Generation Platform",
  description: "Automated B2B lead generation from Telegram and VK. AI-powered prospecting at scale.",
  openGraph: {
    title: "24GO — Lead Generation Platform",
    description: "Automated B2B lead generation from Telegram and VK.",
    url: "https://24go.site",
    siteName: "24GO",
    type: "website",
  },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 lg:px-12 py-5 border-b border-zinc-800/50">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold">24<span className="text-emerald-400">GO</span></span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <a href="/login" className="text-zinc-400 hover:text-zinc-100 transition">Sign in</a>
          <a href="/register" className="px-4 py-2 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition">
            Get Started
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 lg:px-12 pt-24 pb-20 text-center">
        <div className="inline-block px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-medium rounded-full border border-emerald-500/20 mb-6">
          Automated B2B Lead Generation
        </div>
        <h1 className="text-4xl lg:text-6xl font-bold leading-tight mb-6">
          Find <span className="text-emerald-400">qualified leads</span>
          <br />in Telegram &amp; VK
        </h1>
        <p className="text-lg text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          AI-powered platform that discovers, qualifies, and manages B2B prospects
          from social media. Multi-account, multi-tenant, fully automated.
        </p>
        <div className="flex items-center justify-center gap-4">
          <a href="/register" className="px-6 py-3 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition text-base">
            Start Free Trial
          </a>
          <a href="#features" className="px-6 py-3 bg-zinc-800 text-zinc-300 rounded-lg font-medium hover:bg-zinc-700 transition text-base">
            Learn More
          </a>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-5xl mx-auto px-6 lg:px-12 pb-24">
        <h2 className="text-2xl font-bold text-center mb-12">Everything you need</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <FeatureCard icon="🔍" title="Auto-Discovery" desc="Find prospects in target groups automatically. Parse members, messages, and engagement signals." />
          <FeatureCard icon="🤖" title="AI Classification" desc="LLM-powered lead scoring. HOT/WARM/COLD intent detection with configurable rules." />
          <FeatureCard icon="📊" title="Real-time Dashboard" desc="Kanban pipeline, analytics, CSV export. Track every lead from discovery to conversion." />
          <FeatureCard icon="👥" title="Multi-Account" desc="Manage dozens of Telegram accounts with warm-up, daily quotas, and anti-spam protection." />
          <FeatureCard icon="📣" title="Smart Campaigns" desc="Schedule posts with spintax, cron expressions, and per-campaign analytics." />
          <FeatureCard icon="💳" title="Billing & Plans" desc="Stripe and YooKassa integration. Usage-based limits with real-time quota enforcement." />
        </div>
      </section>

      {/* Tech */}
      <section className="border-t border-zinc-800/50 py-16">
        <div className="max-w-5xl mx-auto px-6 lg:px-12 text-center">
          <p className="text-sm text-zinc-500 mb-4">Built with</p>
          <div className="flex items-center justify-center gap-8 text-zinc-600 text-sm">
            <span>FastAPI</span>
            <span>PostgreSQL</span>
            <span>Redis</span>
            <span>Celery</span>
            <span>Next.js</span>
            <span>Telegram Bot API</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800/50 py-8">
        <div className="max-w-5xl mx-auto px-6 lg:px-12 flex items-center justify-between text-xs text-zinc-600">
          <span>24GO</span>
          <span>&copy; {new Date().getFullYear()} All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 hover:border-zinc-700 transition">
      <div className="text-2xl mb-3">{icon}</div>
      <h3 className="font-semibold text-zinc-100 mb-2">{title}</h3>
      <p className="text-sm text-zinc-500 leading-relaxed">{desc}</p>
    </div>
  );
}
