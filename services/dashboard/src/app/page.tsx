"use client";

import { useState, useEffect } from "react";

export default function LandingPage() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-emerald-500/30">
      {/* ── Nav ──────────────────────────────────────────────────── */}
      <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrollY > 50 ? "bg-zinc-950/90 backdrop-blur-xl border-b border-zinc-800/50 shadow-xl shadow-black/20" : ""}`}>
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 lg:px-12 py-5">
          <a href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight">24<span className="text-emerald-400">GO</span></span>
          </a>
          <div className="flex items-center gap-6 text-sm">
            <a href="#features" className="text-zinc-400 hover:text-zinc-100 transition hidden sm:block">Features</a>
            <a href="#how" className="text-zinc-400 hover:text-zinc-100 transition hidden sm:block">How it works</a>
            <a href="/login" className="text-zinc-400 hover:text-zinc-100 transition">Sign in</a>
            <a href="/login" className="px-4 py-2 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition shadow-lg shadow-emerald-500/20">
              Get Started
            </a>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-24 lg:pt-44 lg:pb-36 px-6 lg:px-12 overflow-hidden">
        {/* Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 text-emerald-400 text-xs font-medium rounded-full border border-emerald-500/20 mb-8">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            B2B Lead Generation Platform
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold leading-[1.1] tracking-tight mb-6">
            Find <span className="text-emerald-400 relative">qualified leads
              <svg className="absolute -bottom-1 left-0 w-full h-3 text-emerald-500/30" viewBox="0 0 200 12" fill="none"><path d="M2 8c30-6 60-6 90-3s60 3 106-2" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>
            </span>
            <br />in Telegram &amp; VK
          </h1>

          <p className="text-lg lg:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            AI-powered platform that discovers, qualifies, and manages B2B prospects
            from social media. Multi-account, multi-tenant, fully automated.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="/login" className="w-full sm:w-auto px-8 py-3.5 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition text-base shadow-xl shadow-emerald-500/25">
              Start Free Trial
            </a>
            <a href="#features" className="w-full sm:w-auto px-8 py-3.5 bg-zinc-800/80 text-zinc-300 rounded-xl font-medium hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 transition text-base">
              See Features
            </a>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 mt-16 max-w-lg mx-auto">
            <div>
              <div className="text-2xl lg:text-3xl font-bold text-zinc-100">10x</div>
              <div className="text-xs text-zinc-500 mt-1">Lead discovery speed</div>
            </div>
            <div>
              <div className="text-2xl lg:text-3xl font-bold text-zinc-100">AI</div>
              <div className="text-xs text-zinc-500 mt-1">Intent classification</div>
            </div>
            <div>
              <div className="text-2xl lg:text-3xl font-bold text-zinc-100">24/7</div>
              <div className="text-xs text-zinc-500 mt-1">Automated pipeline</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────── */}
      <section id="features" className="py-24 px-6 lg:px-12 border-t border-zinc-800/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">Everything you need</h2>
            <p className="text-zinc-400 max-w-lg mx-auto">From discovery to conversion — one platform for your entire lead generation workflow.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <FeatureCard icon="🔍" title="Auto-Discovery" desc="Find prospects in target groups automatically. Parse members, messages, and engagement signals across Telegram and VK." />
            <FeatureCard icon="🤖" title="AI Classification" desc="LLM-powered lead scoring. HOT/WARM/COLD intent detection with customizable scoring rules." />
            <FeatureCard icon="📊" title="Real-time Dashboard" desc="Kanban pipeline, analytics, CSV export. Track every lead from discovery to conversion in real-time." />
            <FeatureCard icon="👥" title="Multi-Account" desc="Manage dozens of Telegram accounts with automatic warm-up, daily quotas, and anti-spam protection." />
            <FeatureCard icon="📣" title="Smart Campaigns" desc="Schedule posts with spintax, cron expressions, and per-campaign analytics." />
            <FeatureCard icon="💳" title="Billing & Plans" desc="Stripe and YooKassa integration. Usage-based limits with real-time quota enforcement." />
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────── */}
      <section id="how" className="py-24 px-6 lg:px-12 bg-zinc-900/50 border-t border-zinc-800/50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">How it works</h2>
            <p className="text-zinc-400">Three steps to automated lead generation.</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-8">
            <Step num="1" title="Connect" desc="Add your Telegram accounts and set target groups. We handle warm-up and quotas automatically." />
            <Step num="2" title="Discover" desc="AI scans target communities, captures messages, and qualifies leads in real-time." />
            <Step num="3" title="Convert" desc="Qualified leads appear in your Kanban pipeline. Export to CRM or push to n8n webhooks." />
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────── */}
      <section className="py-24 px-6 lg:px-12 border-t border-zinc-800/50">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl lg:text-4xl font-bold mb-6">Ready to automate your lead generation?</h2>
          <p className="text-zinc-400 mb-10 max-w-lg mx-auto">Start your free trial today. No credit card required.</p>
          <a href="/login" className="inline-block px-10 py-4 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition text-lg shadow-xl shadow-emerald-500/25">
            Get Started Free
          </a>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-800/50 py-10 px-6 lg:px-12">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold">24<span className="text-emerald-400">GO</span></span>
          </div>
          <div className="flex items-center gap-6 text-sm text-zinc-500">
            <a href="#features" className="hover:text-zinc-300 transition">Features</a>
            <a href="/login" className="hover:text-zinc-300 transition">Sign in</a>
          </div>
          <span className="text-xs text-zinc-600">&copy; {new Date().getFullYear()} 24GO. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="group bg-zinc-900 border border-zinc-800 rounded-2xl p-6 hover:border-zinc-700 hover:bg-zinc-800/50 transition-all duration-200">
      <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center text-xl mb-4 group-hover:bg-zinc-700 transition">
        {icon}
      </div>
      <h3 className="font-semibold text-zinc-100 mb-2">{title}</h3>
      <p className="text-sm text-zinc-500 leading-relaxed">{desc}</p>
    </div>
  );
}

function Step({ num, title, desc }: { num: string; title: string; desc: string }) {
  return (
    <div className="text-center sm:text-left">
      <div className="w-10 h-10 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center text-sm font-bold mb-4 mx-auto sm:mx-0 border border-emerald-500/20">
        {num}
      </div>
      <h3 className="font-semibold text-zinc-100 mb-2">{title}</h3>
      <p className="text-sm text-zinc-500 leading-relaxed">{desc}</p>
    </div>
  );
}
