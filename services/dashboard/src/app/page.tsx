"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Search, Bot, ChartBar, UsersGroup, Megaphone, CreditCard,
} from "@/components/Icons";
import { useI18n } from "@/lib/i18n";

export default function LandingPage() {
  const [scrollY, setScrollY] = useState(0);
  const { t } = useI18n();

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
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight">24<span className="text-emerald-400">GO</span></span>
          </Link>
          <div className="flex items-center gap-6 text-sm">
            <a href="#features" className="text-zinc-400 hover:text-zinc-100 transition hidden sm:block">{t("landing.navFeatures")}</a>
            <a href="#how" className="text-zinc-400 hover:text-zinc-100 transition hidden sm:block">{t("landing.navHow")}</a>
            <Link href="/login" className="text-zinc-400 hover:text-zinc-100 transition">{t("landing.navSignIn")}</Link>
            <Link href="/login" className="px-4 py-2 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition shadow-lg shadow-emerald-500/20">
              {t("landing.ctaButton")}
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-24 lg:pt-44 lg:pb-36 px-6 lg:px-12 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 text-emerald-400 text-xs font-medium rounded-full border border-emerald-500/20 mb-8">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            {t("landing.badge")}
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold leading-[1.1] tracking-tight mb-6">
            {t("landing.heroTitle1")}<span className="text-emerald-400 relative">{t("landing.heroTitleHighlight")}
              <svg className="absolute -bottom-1 left-0 w-full h-3 text-emerald-500/30" viewBox="0 0 200 12" fill="none"><path d="M2 8c30-6 60-6 90-3s60 3 106-2" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>
            </span>
            <br />{t("landing.heroTitle2")}
          </h1>

          <p className="text-lg lg:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            {t("landing.heroDesc")}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/login" className="w-full sm:w-auto px-8 py-3.5 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition text-base shadow-xl shadow-emerald-500/25">
              {t("landing.startTrial")}
            </Link>
            <a href="#features" className="w-full sm:w-auto px-8 py-3.5 bg-zinc-800/80 text-zinc-300 rounded-xl font-medium hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 transition text-base">
              {t("landing.seeFeatures")}
            </a>
          </div>

          <div className="grid grid-cols-3 gap-8 mt-16 max-w-lg mx-auto">
            <div>
              <div className="text-2xl lg:text-3xl font-bold text-zinc-100">{t("landing.stat1Value")}</div>
              <div className="text-xs text-zinc-500 mt-1">{t("landing.stat1Label")}</div>
            </div>
            <div>
              <div className="text-2xl lg:text-3xl font-bold text-zinc-100">{t("landing.stat2Value")}</div>
              <div className="text-xs text-zinc-500 mt-1">{t("landing.stat2Label")}</div>
            </div>
            <div>
              <div className="text-2xl lg:text-3xl font-bold text-zinc-100">{t("landing.stat3Value")}</div>
              <div className="text-xs text-zinc-500 mt-1">{t("landing.stat3Label")}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────── */}
      <section id="features" className="py-24 px-6 lg:px-12 border-t border-zinc-800/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">{t("landing.featuresTitle")}</h2>
            <p className="text-zinc-400 max-w-lg mx-auto">{t("landing.featuresDesc")}</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <FeatureCard Icon={Search} title={t("landing.feature1Title")} desc={t("landing.feature1Desc")} />
            <FeatureCard Icon={Bot} title={t("landing.feature2Title")} desc={t("landing.feature2Desc")} />
            <FeatureCard Icon={ChartBar} title={t("landing.feature3Title")} desc={t("landing.feature3Desc")} />
            <FeatureCard Icon={UsersGroup} title={t("landing.feature4Title")} desc={t("landing.feature4Desc")} />
            <FeatureCard Icon={Megaphone} title={t("landing.feature5Title")} desc={t("landing.feature5Desc")} />
            <FeatureCard Icon={CreditCard} title={t("landing.feature6Title")} desc={t("landing.feature6Desc")} />
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────── */}
      <section id="how" className="py-24 px-6 lg:px-12 bg-zinc-900/50 border-t border-zinc-800/50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">{t("landing.howTitle")}</h2>
            <p className="text-zinc-400">{t("landing.howDesc")}</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-8">
            <Step num="1" title={t("landing.step1Title")} desc={t("landing.step1Desc")} />
            <Step num="2" title={t("landing.step2Title")} desc={t("landing.step2Desc")} />
            <Step num="3" title={t("landing.step3Title")} desc={t("landing.step3Desc")} />
          </div>
        </div>
      </section>

      {/* ── Why 24GO ─────────────────────────────────────────── */}
      <section className="py-24 px-6 lg:px-12 border-t border-zinc-800/50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">{t("landing.whyTitle")}</h2>
            <p className="text-zinc-400 max-w-2xl mx-auto">
              {t("landing.whyDesc")}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-8">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <h3 className="font-semibold text-zinc-100 mb-3">{t("landing.seoTitle")}</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">
                {t("landing.seoDesc")}
              </p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <h3 className="font-semibold text-zinc-100 mb-3">{t("landing.aiTitle")}</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">
                {t("landing.aiDesc")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────── */}
      <section className="py-24 px-6 lg:px-12 border-t border-zinc-800/50">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl lg:text-4xl font-bold mb-6">{t("landing.ctaTitle")}</h2>
          <p className="text-zinc-400 mb-10 max-w-lg mx-auto">{t("landing.ctaDesc")}</p>
          <Link href="/login" className="inline-block px-10 py-4 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition text-lg shadow-xl shadow-emerald-500/25">
            {t("landing.ctaButton")}
          </Link>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-800/50 py-10 px-6 lg:px-12">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold">24<span className="text-emerald-400">GO</span></span>
          </div>
          <div className="flex items-center gap-6 text-sm text-zinc-500">
            <a href="#features" className="hover:text-zinc-300 transition">{t("landing.navFeatures")}</a>
            <Link href="/login" className="hover:text-zinc-300 transition">{t("landing.navSignIn")}</Link>
          </div>
          <span className="text-xs text-zinc-600">{t("landing.copyright", { year: new Date().getFullYear() })}</span>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ Icon, title, desc }: { Icon: React.FC<{ className?: string }>; title: string; desc: string }) {
  return (
    <div className="group bg-zinc-900 border border-zinc-800 rounded-2xl p-6 hover:border-zinc-700 hover:bg-zinc-800/50 transition-all duration-200">
      <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-emerald-500/20 transition">
        <Icon className="w-5 h-5 text-emerald-400" />
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
