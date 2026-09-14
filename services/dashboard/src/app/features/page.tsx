import Link from "next/link";
import type { Metadata } from "next";
import { Bot, Users, Send, Brain, BarChart3, Shield, Globe, Zap } from "lucide-react";

export const metadata: Metadata = {
  title: "Features — AI-Powered Lead Generation from Telegram & VK",
  description: "Explore 24GO features: AI lead qualification, automated campaigns, multi-account management, anti-ban protection, analytics, and integrations.",
  alternates: { canonical: "https://www.24go.site/features" },
  robots: { index: true, follow: true },
};

const features = [
  {
    icon: Users,
    title: "Target Group Discovery",
    desc: "Find and analyze Telegram groups where your prospects gather. Filter by member count, activity level, and topic relevance.",
  },
  {
    icon: Brain,
    title: "AI Lead Qualification",
    desc: "Automatically score and classify leads as HOT/WARM/COLD using AI. Focus your time on the most promising prospects.",
  },
  {
    icon: Send,
    title: "Automated Campaigns",
    desc: "Create personalized outreach campaigns with AI-generated messages. Anti-ban protection with rate limiting and content variation.",
  },
  {
    icon: Bot,
    title: "Auto-Replies",
    desc: "Set up intelligent auto-responses that engage prospects 24/7. Keyword matching, AI-powered replies, and response rotation.",
  },
  {
    icon: BarChart3,
    title: "Analytics Dashboard",
    desc: "Track response rates, lead quality, campaign performance, and ROI. Glassmorphism charts for real-time monitoring.",
  },
  {
    icon: Shield,
    title: "Anti-Ban Protection",
    desc: "Built-in rate limiting, account warmup, proxy rotation, and content variation. Keep your accounts safe while scaling.",
  },
  {
    icon: Globe,
    title: "Multi-Platform",
    desc: "Support for both Telegram and VKontakte. Manage all your outreach from a single dashboard.",
  },
  {
    icon: Zap,
    title: "Integrations",
    desc: "Connect with AmoCRM, HubSpot, Google Sheets, webhooks, and more. Automate your entire sales pipeline.",
  },
];

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h1 className="text-4xl lg:text-5xl font-bold mb-4">
            Everything you need for <span className="text-emerald-400">lead generation</span>
          </h1>
          <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
            AI-powered platform for automated lead generation in Telegram and VKontakte.
            From finding prospects to closing deals.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 hover:border-zinc-700 transition"
            >
              <f.icon className="w-8 h-8 text-emerald-400 mb-4" />
              <h3 className="text-zinc-100 font-semibold mb-2">{f.title}</h3>
              <p className="text-zinc-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* How it works */}
        <div className="mt-24">
          <h2 className="text-3xl font-bold text-center mb-12">
            How it works
          </h2>
          <div className="grid md:grid-cols-4 gap-8">
            {[
              { step: "1", title: "Connect Accounts", desc: "Add your Telegram or VK accounts" },
              { step: "2", title: "Add Target Groups", desc: "Find groups where your prospects gather" },
              { step: "3", title: "Create Campaign", desc: "Set up AI-powered personalized outreach" },
              { step: "4", title: "Get Leads", desc: "Receive qualified leads on autopilot" },
            ].map((s) => (
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

        {/* CTA */}
        <div className="mt-24 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to start generating leads?
          </h2>
          <p className="text-zinc-400 mb-8">
            3-day free trial. No credit card required.
          </p>
          <Link
            href="/login"
            className="inline-block px-8 py-3 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition shadow-lg shadow-emerald-500/20"
          >
            Start Free Trial
          </Link>
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
