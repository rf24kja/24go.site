"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import {
  Users,
  Eye,
  Brain,
  Reply,
  Send,
  Megaphone,
  Filter,
  Search,
  Globe,
  BarChart3,
  Plug,
  UserCog,
  FileText,
  Activity,
  Settings,
  Building,
  Code,
  TrendingUp,
} from "lucide-react";

export default function LandingPage() {
  const [scrollY, setScrollY] = useState(0);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const { t, lang, setLang } = useI18n();

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-emerald-500/30 grid-bg">
      {/* ── Nav ──────────────────────────────────────────────────── */}
      <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrollY > 50 ? "bg-zinc-950/90 backdrop-blur-xl border-b border-zinc-800/50 shadow-xl shadow-black/20" : ""}`}>
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 lg:px-12 py-5">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight">24<span className="text-emerald-400">GO</span></span>
          </Link>
          <div className="flex items-center gap-6 text-sm">
            <a href="#how" className="text-zinc-400 hover:text-zinc-100 transition hidden sm:block">{t("landing.navHow")}</a>
            <Link href="/blog" className="text-zinc-400 hover:text-zinc-100 transition hidden sm:block">{t("landing.navBlog")}</Link>
            <Link href="/login" className="text-zinc-400 hover:text-zinc-100 transition">{t("landing.navSignIn")}</Link>
            <div className="flex items-center gap-1 bg-zinc-800 rounded-lg p-0.5">
              <button onClick={() => setLang("en")} className={`px-2 py-1 rounded text-xs font-medium transition ${lang === "en" ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}>EN</button>
              <button onClick={() => setLang("ru")} className={`px-2 py-1 rounded text-xs font-medium transition ${lang === "ru" ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}>RU</button>
            </div>
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
            <a href="#how" className="w-full sm:w-auto px-8 py-3.5 bg-zinc-800/80 text-zinc-300 rounded-xl font-medium hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 transition text-base">
              {t("landing.howTitle")}
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

      {/* ── How it works (full guide with mockups) ──────────────── */}
      <section id="how" className="py-20 px-6 lg:px-12 border-t border-zinc-800/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">{t("landing.howTitle")}</h2>
            <p className="text-zinc-400 max-w-2xl mx-auto">{t("landing.howFullDesc")}</p>
          </div>

          {/* ── Step 1: Connect ─────────────────────────────── */}
          <div className="mb-20">
            <div className="grid lg:grid-cols-2 gap-10 items-center">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center text-sm font-bold border border-emerald-500/20">1</div>
                  <h3 className="text-2xl font-bold text-zinc-100">{t("landing.step1Title")}</h3>
                </div>
                <p className="text-zinc-400 leading-relaxed mb-6">{t("landing.step1Desc")}</p>
                <ul className="space-y-3 text-sm text-zinc-400">
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    <span>{t("landing.step1Point1")}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    <span>{t("landing.step1Point2")}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    <span>{t("landing.step1Point3")}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    <span>{t("landing.step1Point4")}</span>
                  </li>
                </ul>
                <Link href="/login" className="inline-flex items-center gap-2 mt-6 text-emerald-400 hover:text-emerald-300 text-sm font-medium transition">
                  {t("landing.step1Cta")} →
                </Link>
              </div>
              {/* Mockup: Accounts page */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-1 overflow-hidden">
                <div className="bg-zinc-950 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                    <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                    <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                    <span className="ml-2 text-xs text-zinc-600">24GO — Accounts</span>
                  </div>
                  <div className="space-y-2">
                    <MockRow phone="+7 900 *** 1234" status="active" statusColor="emerald" proxy="socks5://***" />
                    <MockRow phone="+44 77 *** 5678" status="warming" statusColor="amber" proxy="socks5://***" />
                    <MockRow phone="+1 212 *** 9012" status="active" statusColor="emerald" proxy="http://***" />
                  </div>
                  <div className="mt-3 flex gap-2">
                    <div className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 text-xs rounded-lg border border-emerald-500/20">{t("landing.mockupAddAccount")}</div>
                    <div className="px-3 py-1.5 bg-zinc-800 text-zinc-400 text-xs rounded-lg border border-zinc-700">{t("landing.mockupBulkImport")}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Step 2: Discover ────────────────────────────── */}
          <div className="mb-20">
            <div className="grid lg:grid-cols-2 gap-10 items-center">
              {/* Mockup: Groups / Monitoring */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-1 overflow-hidden order-2 lg:order-1">
                <div className="bg-zinc-950 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                    <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                    <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                    <span className="ml-2 text-xs text-zinc-600">24GO — Groups</span>
                  </div>
                  <div className="space-y-2">
                    <MockGroupRow name="@marketing_tips" members="12.4K" status="scanning" />
                    <MockGroupRow name="@saas_founders" members="8.2K" status="scanning" />
                    <MockGroupRow name="@b2b_leads" members="34.1K" status="idle" />
                  </div>
                  <div className="mt-3 text-xs text-zinc-600 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                    {t("landing.mockupScanning")}
                  </div>
                </div>
              </div>
              <div className="order-1 lg:order-2">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center text-sm font-bold border border-emerald-500/20">2</div>
                  <h3 className="text-2xl font-bold text-zinc-100">{t("landing.step2Title")}</h3>
                </div>
                <p className="text-zinc-400 leading-relaxed mb-6">{t("landing.step2Desc")}</p>
                <ul className="space-y-3 text-sm text-zinc-400">
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    <span>{t("landing.step2Point1")}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    <span>{t("landing.step2Point2")}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    <span>{t("landing.step2Point3")}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    <span>{t("landing.step2Point4")}</span>
                  </li>
                </ul>
                <div className="flex gap-3 mt-6">
                  <Link href="/login" className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 text-sm font-medium transition">
                    {t("landing.step2Cta")} →
                  </Link>
                  <Link href="/blog/progreva-akkauntov-telegram" className="inline-flex items-center gap-2 text-zinc-500 hover:text-zinc-300 text-sm transition">
                    {t("landing.step2Guide")} →
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* ── Step 3: Convert ─────────────────────────────── */}
          <div className="mb-8">
            <div className="grid lg:grid-cols-2 gap-10 items-center">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center text-sm font-bold border border-emerald-500/20">3</div>
                  <h3 className="text-2xl font-bold text-zinc-100">{t("landing.step3Title")}</h3>
                </div>
                <p className="text-zinc-400 leading-relaxed mb-6">{t("landing.step3Desc")}</p>
                <ul className="space-y-3 text-sm text-zinc-400">
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    <span>{t("landing.step3Point1")}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    <span>{t("landing.step3Point2")}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    <span>{t("landing.step3Point3")}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    <span>{t("landing.step3Point4")}</span>
                  </li>
                </ul>
                <Link href="/login" className="inline-flex items-center gap-2 mt-6 text-emerald-400 hover:text-emerald-300 text-sm font-medium transition">
                  {t("landing.step3Cta")} →
                </Link>
              </div>
              {/* Mockup: Leads Kanban */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-1 overflow-hidden">
                <div className="bg-zinc-950 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                    <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                    <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                    <span className="ml-2 text-xs text-zinc-600">24GO — Leads</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <MockKanbanCol title="HOT" color="rose" count="12" />
                    <MockKanbanCol title="WARM" color="amber" count="28" />
                    <MockKanbanCol title="COLD" color="zinc" count="45" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Registered users hint ───────────────────────────── */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 flex flex-col md:flex-row items-center gap-4 mt-8">
            <div className="flex-1">
              <p className="text-sm text-zinc-400">
                {t("landing.registeredHint")}{" "}
                <a href="https://www.24go.site/help" target="_blank" rel="noopener noreferrer"
                  className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2">
                  {t("landing.registeredLink")}
                </a>
              </p>
            </div>
            <div className="w-full md:w-56 bg-zinc-800 rounded-lg p-3 border border-zinc-700 shrink-0">
              <div className="text-[10px] text-zinc-500 mb-2">{t("landing.guideScreenshot")}</div>
              <div className="space-y-1.5">
                <div className="h-2 bg-zinc-700 rounded w-full" />
                <div className="h-2 bg-zinc-700 rounded w-4/5" />
                <div className="h-2 bg-emerald-500/30 rounded w-3/5" />
                <div className="h-2 bg-zinc-700 rounded w-full" />
                <div className="h-2 bg-zinc-700 rounded w-2/3" />
              </div>
            </div>
          </div>

          {/* ── Real Results ──────────────────────────────────── */}
          <div className="mt-20 pt-12 border-t border-zinc-800/50">
            <div className="text-center mb-12">
              <h3 className="text-2xl lg:text-3xl font-bold mb-3">{t("landing.resultsTitle")}</h3>
              <p className="text-zinc-400 max-w-xl mx-auto">{t("landing.resultsDesc")}</p>
            </div>

            {/* Case study cards */}
            <div className="grid md:grid-cols-3 gap-6 mb-12">
              <CaseStudyCard titleKey="landing.case1Title" resultKey="landing.case1Result" roiKey="landing.case1Roi" icon={Building} />
              <CaseStudyCard titleKey="landing.case2Title" resultKey="landing.case2Result" roiKey="landing.case2Roi" icon={Code} />
              <CaseStudyCard titleKey="landing.case3Title" resultKey="landing.case3Result" roiKey="landing.case3Roi" icon={TrendingUp} />
            </div>

            {/* Metrics bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
              <MetricCard valueKey="landing.metric1Value" labelKey="landing.metric1Label" />
              <MetricCard valueKey="landing.metric2Value" labelKey="landing.metric2Label" />
              <MetricCard valueKey="landing.metric3Value" labelKey="landing.metric3Label" />
              <MetricCard valueKey="landing.metric4Value" labelKey="landing.metric4Label" />
            </div>

            {/* Conversion funnel */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 md:p-8">
              <h4 className="text-lg font-bold text-center mb-6">{t("landing.funnelTitle")}</h4>
              <div className="flex flex-col items-center gap-2">
                <FunnelBar width="100%" text={t("landing.funnelStep1")} color="zinc" />
                <FunnelBar width="75%" text={t("landing.funnelStep2")} color="emerald" />
                <FunnelBar width="55%" text={t("landing.funnelStep3")} color="emerald" />
                <FunnelBar width="38%" text={t("landing.funnelStep4")} color="amber" />
                <FunnelBar width="22%" text={t("landing.funnelStep5")} color="rose" />
              </div>
            </div>
          </div>

          {/* ── Testimonials ──────────────────────────────────── */}
          <div className="mt-20 pt-12 border-t border-zinc-800/50">
            <div className="text-center mb-12">
              <h3 className="text-2xl lg:text-3xl font-bold mb-3">{t("landing.testimonialsTitle")}</h3>
              <div className="flex items-center justify-center gap-3 mb-2">
                <span className="text-3xl font-bold text-emerald-400">{t("landing.testimonialsRating")}</span>
                <div className="flex text-amber-400 text-xl">{"★★★★★"}</div>
              </div>
              <p className="text-sm text-zinc-500">{t("landing.testimonialsCount")}</p>
            </div>

            <div className="flex items-center justify-center gap-6 mb-10 text-sm">
              {[5,4,3,2,1].map((n) => (
                <div key={n} className="flex items-center gap-2">
                  <span className="text-zinc-400">{n}★</span>
                  <div className="w-20 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full" style={{ width: t(`landing.star${n}Percent`) }} />
                  </div>
                  <span className="text-zinc-500 w-8 text-right">{t(`landing.star${n}Percent`)}</span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {TESTIMONIALS.map((r, i) => (
                <TestimonialCard key={i} {...r} />
              ))}
            </div>
            <div className="text-center mt-8">
              <button
                onClick={() => setShowAllReviews(true)}
                className="px-6 py-2.5 bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-lg text-sm font-medium hover:bg-zinc-700 transition btn-press"
              >
                {t("landing.viewAllReviews").replace("{count}", String(TESTIMONIALS.length))}
              </button>
            </div>
          </div>

          {/* ── All platform features ─────────────────────── */}
          <div className="mt-16 pt-12 border-t border-zinc-800/50">
            <div className="text-center mb-10">
              <h3 className="text-2xl lg:text-3xl font-bold mb-3">{t("landing.allFeaturesTitle")}</h3>
              <p className="text-zinc-400 max-w-xl mx-auto">{t("landing.allFeaturesDesc")}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { icon: Users, titleKey: "landing.feat1Title", descKey: "landing.feat1Desc" },
                { icon: Eye, titleKey: "landing.feat2Title", descKey: "landing.feat2Desc" },
                { icon: Brain, titleKey: "landing.feat3Title", descKey: "landing.feat3Desc" },
                { icon: Reply, titleKey: "landing.feat4Title", descKey: "landing.feat4Desc" },
                { icon: Send, titleKey: "landing.feat5Title", descKey: "landing.feat5Desc" },
                { icon: Megaphone, titleKey: "landing.feat6Title", descKey: "landing.feat6Desc" },
                { icon: Filter, titleKey: "landing.feat7Title", descKey: "landing.feat7Desc" },
                { icon: Search, titleKey: "landing.feat8Title", descKey: "landing.feat8Desc" },
                { icon: Globe, titleKey: "landing.feat9Title", descKey: "landing.feat9Desc" },
                { icon: BarChart3, titleKey: "landing.feat10Title", descKey: "landing.feat10Desc" },
                { icon: Plug, titleKey: "landing.feat11Title", descKey: "landing.feat11Desc" },
                { icon: UserCog, titleKey: "landing.feat12Title", descKey: "landing.feat12Desc" },
                { icon: FileText, titleKey: "landing.feat13Title", descKey: "landing.feat13Desc" },
                { icon: Activity, titleKey: "landing.feat14Title", descKey: "landing.feat14Desc" },
                { icon: Settings, titleKey: "landing.feat15Title", descKey: "landing.feat15Desc" },
              ].map((f, i) => (
                <div key={i} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 hover:border-emerald-500/30 transition">
                  <div className="flex items-center gap-3 mb-2">
                    <f.icon className="w-5 h-5 text-emerald-400" />
                    <h4 className="font-semibold text-zinc-100">{t(f.titleKey)}</h4>
                  </div>
                  <p className="text-sm text-zinc-400">{t(f.descKey)}</p>
                </div>
              ))}
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
            <a href="#how" className="hover:text-zinc-300 transition">{t("landing.navHow")}</a>
            <Link href="/blog" className="hover:text-zinc-300 transition">{t("landing.navBlog")}</Link>
            <Link href="/login" className="hover:text-zinc-300 transition">{t("landing.navSignIn")}</Link>
          </div>
          <span className="text-xs text-zinc-600">{t("landing.copyright", { year: new Date().getFullYear() })}</span>
        </div>
      </footer>

      {/* Full-screen reviews overlay */}
      {showAllReviews && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 overflow-y-auto animate-fade-slide-in"
          onClick={() => setShowAllReviews(false)}>
          <div className="min-h-screen p-6" onClick={(e) => e.stopPropagation()}>
            <div className="max-w-5xl mx-auto">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-zinc-100">{t("landing.testimonialsTitle")}</h2>
                  <p className="text-sm text-zinc-400 mt-1">{t("landing.testimonialsCount")}</p>
                </div>
                <button onClick={() => setShowAllReviews(false)}
                  className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg text-sm hover:bg-zinc-700 transition border border-zinc-700">
                  {t("landing.closeReviews")}
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {TESTIMONIALS.map((testimonial, i) => (
                  <div key={i}
                    className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-600 transition-all duration-300"
                    style={{ animationDelay: `${i * 50}ms` }}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${getColorClass(testimonial.color)}`}>
                        {testimonial.initials}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-zinc-100">{t(testimonial.nameKey)}</p>
                        <p className="text-xs text-zinc-500">{t(testimonial.roleKey)} · {t(testimonial.companyKey)}</p>
                      </div>
                    </div>
                    <div className="flex gap-0.5 mb-2">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <span key={j} className={`text-xs ${j < parseInt(t(testimonial.ratingKey)) ? "text-amber-400" : "text-zinc-700"}`}>★</span>
                      ))}
                    </div>
                    <p className="text-sm text-zinc-400 leading-relaxed">{t(testimonial.textKey)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Mockup Components ────────────────────────────────────────────

function getColorClass(color: string): string {
  const map: Record<string, string> = {
    emerald: "bg-emerald-500/20 text-emerald-400",
    blue: "bg-blue-500/20 text-blue-400",
    amber: "bg-amber-500/20 text-amber-400",
    rose: "bg-rose-500/20 text-rose-400",
    violet: "bg-violet-500/20 text-violet-400",
    cyan: "bg-cyan-500/20 text-cyan-400",
    orange: "bg-orange-500/20 text-orange-400",
    teal: "bg-teal-500/20 text-teal-400",
    indigo: "bg-indigo-500/20 text-indigo-400",
    pink: "bg-pink-500/20 text-pink-400",
    lime: "bg-lime-500/20 text-lime-400",
    fuchsia: "bg-fuchsia-500/20 text-fuchsia-400",
    red: "bg-red-500/20 text-red-400",
    yellow: "bg-yellow-500/20 text-yellow-400",
    sky: "bg-sky-500/20 text-sky-400",
  };
  return map[color] || map.emerald;
}

function MockRow({ phone, status, statusColor, proxy }: { phone: string; status: string; statusColor: string; proxy: string }) {
  const colors: Record<string, string> = { emerald: "bg-emerald-400", amber: "bg-amber-400" };
  return (
    <div className="flex items-center justify-between bg-zinc-900 rounded-lg px-3 py-2">
      <div className="flex items-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full ${colors[statusColor] || "bg-zinc-500"}`} />
        <span className="text-xs text-zinc-300 font-mono">{phone}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-zinc-500">{proxy}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded bg-${statusColor}-500/10 text-${statusColor}-400`}>{status}</span>
      </div>
    </div>
  );
}

function MockGroupRow({ name, members, status }: { name: string; members: string; status: string }) {
  return (
    <div className="flex items-center justify-between bg-zinc-900 rounded-lg px-3 py-2">
      <div className="flex items-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full ${status === "scanning" ? "bg-emerald-400 animate-pulse" : "bg-zinc-500"}`} />
        <span className="text-xs text-zinc-300">{name}</span>
      </div>
      <span className="text-[10px] text-zinc-500">{members}</span>
    </div>
  );
}

function MockKanbanCol({ title, color, count }: { title: string; color: string; count: string }) {
  const borderColors: Record<string, string> = { rose: "border-rose-500/30", amber: "border-amber-500/30", zinc: "border-zinc-700" };
  const textColors: Record<string, string> = { rose: "text-rose-400", amber: "text-amber-400", zinc: "text-zinc-400" };
  return (
    <div className={`rounded-lg border ${borderColors[color]} p-2`}>
      <div className={`text-[10px] font-medium ${textColors[color]} mb-2`}>{title}</div>
      <div className="space-y-1.5">
        {Array.from({ length: Math.min(parseInt(count), 3) }).map((_, i) => (
          <div key={i} className="bg-zinc-900 rounded px-2 py-1.5">
            <div className="h-1.5 bg-zinc-700 rounded w-3/4 mb-1" />
            <div className="h-1 bg-zinc-800 rounded w-1/2" />
          </div>
        ))}
        {parseInt(count) > 3 && (
          <div className="text-center text-[9px] text-zinc-600">+{parseInt(count) - 3}</div>
        )}
      </div>
    </div>
  );
}

function CaseStudyCard({ titleKey, resultKey, roiKey, icon: Icon }: { titleKey: string; resultKey: string; roiKey: string; icon: React.ComponentType<{ className?: string }> }) {
  const { t } = useI18n();
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 hover:border-emerald-500/30 transition">
      <div className="mb-3"><Icon className="w-8 h-8 text-emerald-400" /></div>
      <h4 className="font-semibold text-zinc-100 mb-2">{t(titleKey)}</h4>
      <p className="text-sm text-zinc-400 mb-3">{t(resultKey)}</p>
      <div className="text-emerald-400 font-bold text-lg">{t(roiKey)}</div>
    </div>
  );
}

function MetricCard({ valueKey, labelKey }: { valueKey: string; labelKey: string }) {
  const { t } = useI18n();
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-center">
      <div className="text-2xl font-bold text-emerald-400">{t(valueKey)}</div>
      <div className="text-xs text-zinc-500 mt-1">{t(labelKey)}</div>
    </div>
  );
}

function FunnelBar({ width, text, color }: { width: string; text: string; color: string }) {
  const colors: Record<string, string> = {
    zinc: "bg-zinc-700",
    emerald: "bg-emerald-500/30 border-emerald-500/40",
    amber: "bg-amber-500/30 border-amber-500/40",
    rose: "bg-rose-500/30 border-rose-500/40",
  };
  return (
    <div className={`rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 text-center ${colors[color] || colors.zinc}`}
      style={{ width }}>
      {text}
    </div>
  );
}

const TESTIMONIALS = [
  { nameKey: "landing.t1Name", companyKey: "landing.t1Company", roleKey: "landing.t1Role", textKey: "landing.t1Text", ratingKey: "landing.t1Rating", initials: "AP", color: "emerald" },
  { nameKey: "landing.t2Name", companyKey: "landing.t2Company", roleKey: "landing.t2Role", textKey: "landing.t2Text", ratingKey: "landing.t2Rating", initials: "SC", color: "blue" },
  { nameKey: "landing.t3Name", companyKey: "landing.t3Company", roleKey: "landing.t3Role", textKey: "landing.t3Text", ratingKey: "landing.t3Rating", initials: "DV", color: "amber" },
  { nameKey: "landing.t4Name", companyKey: "landing.t4Company", roleKey: "landing.t4Role", textKey: "landing.t4Text", ratingKey: "landing.t4Rating", initials: "MI", color: "rose" },
  { nameKey: "landing.t5Name", companyKey: "landing.t5Company", roleKey: "landing.t5Role", textKey: "landing.t5Text", ratingKey: "landing.t5Rating", initials: "JW", color: "violet" },
  { nameKey: "landing.t6Name", companyKey: "landing.t6Company", roleKey: "landing.t6Role", textKey: "landing.t6Text", ratingKey: "landing.t6Rating", initials: "EK", color: "cyan" },
  { nameKey: "landing.t7Name", companyKey: "landing.t7Company", roleKey: "landing.t7Role", textKey: "landing.t7Text", ratingKey: "landing.t7Rating", initials: "AH", color: "orange" },
  { nameKey: "landing.t8Name", companyKey: "landing.t8Company", roleKey: "landing.t8Role", textKey: "landing.t8Text", ratingKey: "landing.t8Rating", initials: "AS", color: "teal" },
  { nameKey: "landing.t9Name", companyKey: "landing.t9Company", roleKey: "landing.t9Role", textKey: "landing.t9Text", ratingKey: "landing.t9Rating", initials: "TB", color: "indigo" },
  { nameKey: "landing.t10Name", companyKey: "landing.t10Company", roleKey: "landing.t10Role", textKey: "landing.t10Text", ratingKey: "landing.t10Rating", initials: "OP", color: "pink" },
  { nameKey: "landing.t11Name", companyKey: "landing.t11Company", roleKey: "landing.t11Role", textKey: "landing.t11Text", ratingKey: "landing.t11Rating", initials: "KT", color: "lime" },
  { nameKey: "landing.t12Name", companyKey: "landing.t12Company", roleKey: "landing.t12Role", textKey: "landing.t12Text", ratingKey: "landing.t12Rating", initials: "NF", color: "fuchsia" },
  { nameKey: "landing.t13Name", companyKey: "landing.t13Company", roleKey: "landing.t13Role", textKey: "landing.t13Text", ratingKey: "landing.t13Rating", initials: "MB", color: "red" },
  { nameKey: "landing.t14Name", companyKey: "landing.t14Company", roleKey: "landing.t14Role", textKey: "landing.t14Text", ratingKey: "landing.t14Rating", initials: "IV", color: "yellow" },
  { nameKey: "landing.t15Name", companyKey: "landing.t15Company", roleKey: "landing.t15Role", textKey: "landing.t15Text", ratingKey: "landing.t15Rating", initials: "DK", color: "sky" },
  { nameKey: "landing.t16Name", companyKey: "landing.t16Company", roleKey: "landing.t16Role", textKey: "landing.t16Text", ratingKey: "landing.t16Rating", initials: "TS", color: "violet" },
  { nameKey: "landing.t17Name", companyKey: "landing.t17Company", roleKey: "landing.t17Role", textKey: "landing.t17Text", ratingKey: "landing.t17Rating", initials: "CM", color: "emerald" },
  { nameKey: "landing.t18Name", companyKey: "landing.t18Company", roleKey: "landing.t18Role", textKey: "landing.t18Text", ratingKey: "landing.t18Rating", initials: "YS", color: "blue" },
  { nameKey: "landing.t19Name", companyKey: "landing.t19Company", roleKey: "landing.t19Role", textKey: "landing.t19Text", ratingKey: "landing.t19Rating", initials: "AP", color: "amber" },
  { nameKey: "landing.t20Name", companyKey: "landing.t20Company", roleKey: "landing.t20Role", textKey: "landing.t20Text", ratingKey: "landing.t20Rating", initials: "MJ", color: "rose" },
  { nameKey: "landing.t21Name", companyKey: "landing.t21Company", roleKey: "landing.t21Role", textKey: "landing.t21Text", ratingKey: "landing.t21Rating", initials: "ES", color: "violet" },
  { nameKey: "landing.t22Name", companyKey: "landing.t22Company", roleKey: "landing.t22Role", textKey: "landing.t22Text", ratingKey: "landing.t22Rating", initials: "OA", color: "cyan" },
  { nameKey: "landing.t23Name", companyKey: "landing.t23Company", roleKey: "landing.t23Role", textKey: "landing.t23Text", ratingKey: "landing.t23Rating", initials: "LW", color: "orange" },
  { nameKey: "landing.t24Name", companyKey: "landing.t24Company", roleKey: "landing.t24Role", textKey: "landing.t24Text", ratingKey: "landing.t24Rating", initials: "PK", color: "teal" },
  { nameKey: "landing.t25Name", companyKey: "landing.t25Company", roleKey: "landing.t25Role", textKey: "landing.t25Text", ratingKey: "landing.t25Rating", initials: "SM", color: "indigo" },
  { nameKey: "landing.t26Name", companyKey: "landing.t26Company", roleKey: "landing.t26Role", textKey: "landing.t26Text", ratingKey: "landing.t26Rating", initials: "RP", color: "pink" },
  { nameKey: "landing.t27Name", companyKey: "landing.t27Company", roleKey: "landing.t27Role", textKey: "landing.t27Text", ratingKey: "landing.t27Rating", initials: "MG", color: "lime" },
  { nameKey: "landing.t28Name", companyKey: "landing.t28Company", roleKey: "landing.t28Role", textKey: "landing.t28Text", ratingKey: "landing.t28Rating", initials: "TW", color: "fuchsia" },
  { nameKey: "landing.t29Name", companyKey: "landing.t29Company", roleKey: "landing.t29Role", textKey: "landing.t29Text", ratingKey: "landing.t29Rating", initials: "CW", color: "red" },
  { nameKey: "landing.t30Name", companyKey: "landing.t30Company", roleKey: "landing.t30Role", textKey: "landing.t30Text", ratingKey: "landing.t30Rating", initials: "OS", color: "yellow" },
  { nameKey: "landing.t31Name", companyKey: "landing.t31Company", roleKey: "landing.t31Role", textKey: "landing.t31Text", ratingKey: "landing.t31Rating", initials: "JO", color: "sky" },
  { nameKey: "landing.t32Name", companyKey: "landing.t32Company", roleKey: "landing.t32Role", textKey: "landing.t32Text", ratingKey: "landing.t32Rating", initials: "FH", color: "emerald" },
  { nameKey: "landing.t33Name", companyKey: "landing.t33Company", roleKey: "landing.t33Role", textKey: "landing.t33Text", ratingKey: "landing.t33Rating", initials: "DP", color: "blue" },
  { nameKey: "landing.t34Name", companyKey: "landing.t34Company", roleKey: "landing.t34Role", textKey: "landing.t34Text", ratingKey: "landing.t34Rating", initials: "KY", color: "amber" },
  { nameKey: "landing.t35Name", companyKey: "landing.t35Company", roleKey: "landing.t35Role", textKey: "landing.t35Text", ratingKey: "landing.t35Rating", initials: "AS", color: "rose" },
  { nameKey: "landing.t36Name", companyKey: "landing.t36Company", roleKey: "landing.t36Role", textKey: "landing.t36Text", ratingKey: "landing.t36Rating", initials: "VL", color: "violet" },
  { nameKey: "landing.t37Name", companyKey: "landing.t37Company", roleKey: "landing.t37Role", textKey: "landing.t37Text", ratingKey: "landing.t37Rating", initials: "NI", color: "cyan" },
  { nameKey: "landing.t38Name", companyKey: "landing.t38Company", roleKey: "landing.t38Role", textKey: "landing.t38Text", ratingKey: "landing.t38Rating", initials: "AM", color: "orange" },
  { nameKey: "landing.t39Name", companyKey: "landing.t39Company", roleKey: "landing.t39Role", textKey: "landing.t39Text", ratingKey: "landing.t39Rating", initials: "JS", color: "teal" },
  { nameKey: "landing.t40Name", companyKey: "landing.t40Company", roleKey: "landing.t40Role", textKey: "landing.t40Text", ratingKey: "landing.t40Rating", initials: "PT", color: "indigo" },
  { nameKey: "landing.t41Name", companyKey: "landing.t41Company", roleKey: "landing.t41Role", textKey: "landing.t41Text", ratingKey: "landing.t41Rating", initials: "IK", color: "pink" },
  { nameKey: "landing.t42Name", companyKey: "landing.t42Company", roleKey: "landing.t42Role", textKey: "landing.t42Text", ratingKey: "landing.t42Rating", initials: "MR", color: "lime" },
  { nameKey: "landing.t43Name", companyKey: "landing.t43Company", roleKey: "landing.t43Role", textKey: "landing.t43Text", ratingKey: "landing.t43Rating", initials: "SF", color: "fuchsia" },
  { nameKey: "landing.t44Name", companyKey: "landing.t44Company", roleKey: "landing.t44Role", textKey: "landing.t44Text", ratingKey: "landing.t44Rating", initials: "DB", color: "red" },
  { nameKey: "landing.t45Name", companyKey: "landing.t45Company", roleKey: "landing.t45Role", textKey: "landing.t45Text", ratingKey: "landing.t45Rating", initials: "AK", color: "yellow" },
  { nameKey: "landing.t46Name", companyKey: "landing.t46Company", roleKey: "landing.t46Role", textKey: "landing.t46Text", ratingKey: "landing.t46Rating", initials: "AK", color: "sky" },
  { nameKey: "landing.t47Name", companyKey: "landing.t47Company", roleKey: "landing.t47Role", textKey: "landing.t47Text", ratingKey: "landing.t47Rating", initials: "LJ", color: "emerald" },
  { nameKey: "landing.t48Name", companyKey: "landing.t48Company", roleKey: "landing.t48Role", textKey: "landing.t48Text", ratingKey: "landing.t48Rating", initials: "SV", color: "blue" },
  { nameKey: "landing.t49Name", companyKey: "landing.t49Company", roleKey: "landing.t49Role", textKey: "landing.t49Text", ratingKey: "landing.t49Rating", initials: "PS", color: "amber" },
  { nameKey: "landing.t50Name", companyKey: "landing.t50Company", roleKey: "landing.t50Role", textKey: "landing.t50Text", ratingKey: "landing.t50Rating", initials: "MS", color: "rose" },
  { nameKey: "landing.t51Name", companyKey: "landing.t51Company", roleKey: "landing.t51Role", textKey: "landing.t51Text", ratingKey: "landing.t51Rating", initials: "TM", color: "violet" },
  { nameKey: "landing.t52Name", companyKey: "landing.t52Company", roleKey: "landing.t52Role", textKey: "landing.t52Text", ratingKey: "landing.t52Rating", initials: "JL", color: "cyan" },
  { nameKey: "landing.t53Name", companyKey: "landing.t53Company", roleKey: "landing.t53Role", textKey: "landing.t53Text", ratingKey: "landing.t53Rating", initials: "EV", color: "orange" },
  { nameKey: "landing.t54Name", companyKey: "landing.t54Company", roleKey: "landing.t54Role", textKey: "landing.t54Text", ratingKey: "landing.t54Rating", initials: "CH", color: "teal" },
  { nameKey: "landing.t55Name", companyKey: "landing.t55Company", roleKey: "landing.t55Role", textKey: "landing.t55Text", ratingKey: "landing.t55Rating", initials: "DN", color: "indigo" },
  { nameKey: "landing.t56Name", companyKey: "landing.t56Company", roleKey: "landing.t56Role", textKey: "landing.t56Text", ratingKey: "landing.t56Rating", initials: "HT", color: "pink" },
  { nameKey: "landing.t57Name", companyKey: "landing.t57Company", roleKey: "landing.t57Role", textKey: "landing.t57Text", ratingKey: "landing.t57Rating", initials: "MS", color: "lime" },
  { nameKey: "landing.t58Name", companyKey: "landing.t58Company", roleKey: "landing.t58Role", textKey: "landing.t58Text", ratingKey: "landing.t58Rating", initials: "RK", color: "fuchsia" },
  { nameKey: "landing.t59Name", companyKey: "landing.t59Company", roleKey: "landing.t59Role", textKey: "landing.t59Text", ratingKey: "landing.t59Rating", initials: "EB", color: "red" },
  { nameKey: "landing.t60Name", companyKey: "landing.t60Company", roleKey: "landing.t60Role", textKey: "landing.t60Text", ratingKey: "landing.t60Rating", initials: "SM", color: "yellow" },
  { nameKey: "landing.t61Name", companyKey: "landing.t61Company", roleKey: "landing.t61Role", textKey: "landing.t61Text", ratingKey: "landing.t61Rating", initials: "OP", color: "sky" },
  { nameKey: "landing.t62Name", companyKey: "landing.t62Company", roleKey: "landing.t62Role", textKey: "landing.t62Text", ratingKey: "landing.t62Rating", initials: "AY", color: "emerald" },
  { nameKey: "landing.t63Name", companyKey: "landing.t63Company", roleKey: "landing.t63Role", textKey: "landing.t63Text", ratingKey: "landing.t63Rating", initials: "CD", color: "blue" },
  { nameKey: "landing.t64Name", companyKey: "landing.t64Company", roleKey: "landing.t64Role", textKey: "landing.t64Text", ratingKey: "landing.t64Rating", initials: "VS", color: "amber" },
  { nameKey: "landing.t65Name", companyKey: "landing.t65Company", roleKey: "landing.t65Role", textKey: "landing.t65Text", ratingKey: "landing.t65Rating", initials: "YP", color: "rose" },
  { nameKey: "landing.t66Name", companyKey: "landing.t66Company", roleKey: "landing.t66Role", textKey: "landing.t66Text", ratingKey: "landing.t66Rating", initials: "PO", color: "violet" },
  { nameKey: "landing.t67Name", companyKey: "landing.t67Company", roleKey: "landing.t67Role", textKey: "landing.t67Text", ratingKey: "landing.t67Rating", initials: "NR", color: "cyan" },
  { nameKey: "landing.t68Name", companyKey: "landing.t68Company", roleKey: "landing.t68Role", textKey: "landing.t68Text", ratingKey: "landing.t68Rating", initials: "TN", color: "orange" },
  { nameKey: "landing.t69Name", companyKey: "landing.t69Company", roleKey: "landing.t69Role", textKey: "landing.t69Text", ratingKey: "landing.t69Rating", initials: "AF", color: "teal" },
  { nameKey: "landing.t70Name", companyKey: "landing.t70Company", roleKey: "landing.t70Role", textKey: "landing.t70Text", ratingKey: "landing.t70Rating", initials: "EW", color: "indigo" },
  { nameKey: "landing.t71Name", companyKey: "landing.t71Company", roleKey: "landing.t71Role", textKey: "landing.t71Text", ratingKey: "landing.t71Rating", initials: "IC", color: "pink" },
  { nameKey: "landing.t72Name", companyKey: "landing.t72Company", roleKey: "landing.t72Role", textKey: "landing.t72Text", ratingKey: "landing.t72Rating", initials: "HD", color: "lime" },
  { nameKey: "landing.t73Name", companyKey: "landing.t73Company", roleKey: "landing.t73Role", textKey: "landing.t73Text", ratingKey: "landing.t73Rating", initials: "GM", color: "fuchsia" },
  { nameKey: "landing.t74Name", companyKey: "landing.t74Company", roleKey: "landing.t74Role", textKey: "landing.t74Text", ratingKey: "landing.t74Rating", initials: "FC", color: "red" },
  { nameKey: "landing.t75Name", companyKey: "landing.t75Company", roleKey: "landing.t75Role", textKey: "landing.t75Text", ratingKey: "landing.t75Rating", initials: "LG", color: "yellow" },
  { nameKey: "landing.t76Name", companyKey: "landing.t76Company", roleKey: "landing.t76Role", textKey: "landing.t76Text", ratingKey: "landing.t76Rating", initials: "MN", color: "sky" },
  { nameKey: "landing.t77Name", companyKey: "landing.t77Company", roleKey: "landing.t77Role", textKey: "landing.t77Text", ratingKey: "landing.t77Rating", initials: "JM", color: "emerald" },
  { nameKey: "landing.t78Name", companyKey: "landing.t78Company", roleKey: "landing.t78Role", textKey: "landing.t78Text", ratingKey: "landing.t78Rating", initials: "BT", color: "blue" },
  { nameKey: "landing.t79Name", companyKey: "landing.t79Company", roleKey: "landing.t79Role", textKey: "landing.t79Text", ratingKey: "landing.t79Rating", initials: "SK", color: "amber" },
  { nameKey: "landing.t80Name", companyKey: "landing.t80Company", roleKey: "landing.t80Role", textKey: "landing.t80Text", ratingKey: "landing.t80Rating", initials: "PD", color: "rose" },
  { nameKey: "landing.t81Name", companyKey: "landing.t81Company", roleKey: "landing.t81Role", textKey: "landing.t81Text", ratingKey: "landing.t81Rating", initials: "AF", color: "violet" },
  { nameKey: "landing.t82Name", companyKey: "landing.t82Company", roleKey: "landing.t82Role", textKey: "landing.t82Text", ratingKey: "landing.t82Rating", initials: "WH", color: "cyan" },
  { nameKey: "landing.t83Name", companyKey: "landing.t83Company", roleKey: "landing.t83Role", textKey: "landing.t83Text", ratingKey: "landing.t83Rating", initials: "NS", color: "orange" },
  { nameKey: "landing.t84Name", companyKey: "landing.t84Company", roleKey: "landing.t84Role", textKey: "landing.t84Text", ratingKey: "landing.t84Rating", initials: "MG", color: "teal" },
  { nameKey: "landing.t85Name", companyKey: "landing.t85Company", roleKey: "landing.t85Role", textKey: "landing.t85Text", ratingKey: "landing.t85Rating", initials: "SM", color: "indigo" },
  { nameKey: "landing.t86Name", companyKey: "landing.t86Company", roleKey: "landing.t86Role", textKey: "landing.t86Text", ratingKey: "landing.t86Rating", initials: "TS", color: "pink" },
  { nameKey: "landing.t87Name", companyKey: "landing.t87Company", roleKey: "landing.t87Role", textKey: "landing.t87Text", ratingKey: "landing.t87Rating", initials: "DF", color: "lime" },
  { nameKey: "landing.t88Name", companyKey: "landing.t88Company", roleKey: "landing.t88Role", textKey: "landing.t88Text", ratingKey: "landing.t88Rating", initials: "MK", color: "fuchsia" },
  { nameKey: "landing.t89Name", companyKey: "landing.t89Company", roleKey: "landing.t89Role", textKey: "landing.t89Text", ratingKey: "landing.t89Rating", initials: "VN", color: "red" },
  { nameKey: "landing.t90Name", companyKey: "landing.t90Company", roleKey: "landing.t90Role", textKey: "landing.t90Text", ratingKey: "landing.t90Rating", initials: "AB", color: "yellow" },
  { nameKey: "landing.t91Name", companyKey: "landing.t91Company", roleKey: "landing.t91Role", textKey: "landing.t91Text", ratingKey: "landing.t91Rating", initials: "CE", color: "sky" },
  { nameKey: "landing.t92Name", companyKey: "landing.t92Company", roleKey: "landing.t92Role", textKey: "landing.t92Text", ratingKey: "landing.t92Rating", initials: "OZ", color: "emerald" },
  { nameKey: "landing.t93Name", companyKey: "landing.t93Company", roleKey: "landing.t93Role", textKey: "landing.t93Text", ratingKey: "landing.t93Rating", initials: "IS", color: "blue" },
  { nameKey: "landing.t94Name", companyKey: "landing.t94Company", roleKey: "landing.t94Role", textKey: "landing.t94Text", ratingKey: "landing.t94Rating", initials: "EK", color: "amber" },
  { nameKey: "landing.t95Name", companyKey: "landing.t95Company", roleKey: "landing.t95Role", textKey: "landing.t95Text", ratingKey: "landing.t95Rating", initials: "AC", color: "rose" },
  { nameKey: "landing.t96Name", companyKey: "landing.t96Company", roleKey: "landing.t96Role", textKey: "landing.t96Text", ratingKey: "landing.t96Rating", initials: "NS", color: "violet" },
  { nameKey: "landing.t97Name", companyKey: "landing.t97Company", roleKey: "landing.t97Role", textKey: "landing.t97Text", ratingKey: "landing.t97Rating", initials: "DK", color: "cyan" },
  { nameKey: "landing.t98Name", companyKey: "landing.t98Company", roleKey: "landing.t98Role", textKey: "landing.t98Text", ratingKey: "landing.t98Rating", initials: "CW", color: "orange" },
  { nameKey: "landing.t99Name", companyKey: "landing.t99Company", roleKey: "landing.t99Role", textKey: "landing.t99Text", ratingKey: "landing.t99Rating", initials: "LA", color: "teal" },
  { nameKey: "landing.t100Name", companyKey: "landing.t100Company", roleKey: "landing.t100Role", textKey: "landing.t100Text", ratingKey: "landing.t100Rating", initials: "JW", color: "indigo" },
  { nameKey: "landing.t101Name", companyKey: "landing.t101Company", roleKey: "landing.t101Role", textKey: "landing.t101Text", ratingKey: "landing.t101Rating", initials: "AM", color: "pink" },
  { nameKey: "landing.t102Name", companyKey: "landing.t102Company", roleKey: "landing.t102Role", textKey: "landing.t102Text", ratingKey: "landing.t102Rating", initials: "SL", color: "lime" },
  { nameKey: "landing.t103Name", companyKey: "landing.t103Company", roleKey: "landing.t103Role", textKey: "landing.t103Text", ratingKey: "landing.t103Rating", initials: "KB", color: "fuchsia" },
  { nameKey: "landing.t104Name", companyKey: "landing.t104Company", roleKey: "landing.t104Role", textKey: "landing.t104Text", ratingKey: "landing.t104Rating", initials: "ES", color: "red" },
  { nameKey: "landing.t105Name", companyKey: "landing.t105Company", roleKey: "landing.t105Role", textKey: "landing.t105Text", ratingKey: "landing.t105Rating", initials: "KM", color: "yellow" },
  { nameKey: "landing.t106Name", companyKey: "landing.t106Company", roleKey: "landing.t106Role", textKey: "landing.t106Text", ratingKey: "landing.t106Rating", initials: "OA", color: "sky" },
  { nameKey: "landing.t107Name", companyKey: "landing.t107Company", roleKey: "landing.t107Role", textKey: "landing.t107Text", ratingKey: "landing.t107Rating", initials: "RB", color: "emerald" },
  { nameKey: "landing.t108Name", companyKey: "landing.t108Company", roleKey: "landing.t108Role", textKey: "landing.t108Text", ratingKey: "landing.t108Rating", initials: "SK", color: "blue" },
  { nameKey: "landing.t109Name", companyKey: "landing.t109Company", roleKey: "landing.t109Role", textKey: "landing.t109Text", ratingKey: "landing.t109Rating", initials: "TF", color: "amber" },
  { nameKey: "landing.t110Name", companyKey: "landing.t110Company", roleKey: "landing.t110Role", textKey: "landing.t110Text", ratingKey: "landing.t110Rating", initials: "SK", color: "rose" },
  { nameKey: "landing.t111Name", companyKey: "landing.t111Company", roleKey: "landing.t111Role", textKey: "landing.t111Text", ratingKey: "landing.t111Rating", initials: "IT", color: "violet" },
  { nameKey: "landing.t112Name", companyKey: "landing.t112Company", roleKey: "landing.t112Role", textKey: "landing.t112Text", ratingKey: "landing.t112Rating", initials: "MZ", color: "cyan" },
  { nameKey: "landing.t113Name", companyKey: "landing.t113Company", roleKey: "landing.t113Role", textKey: "landing.t113Text", ratingKey: "landing.t113Rating", initials: "BS", color: "orange" },
  { nameKey: "landing.t114Name", companyKey: "landing.t114Company", roleKey: "landing.t114Role", textKey: "landing.t114Text", ratingKey: "landing.t114Rating", initials: "AC", color: "teal" },
  { nameKey: "landing.t115Name", companyKey: "landing.t115Company", roleKey: "landing.t115Role", textKey: "landing.t115Text", ratingKey: "landing.t115Rating", initials: "PM", color: "indigo" },
  { nameKey: "landing.t116Name", companyKey: "landing.t116Company", roleKey: "landing.t116Role", textKey: "landing.t116Text", ratingKey: "landing.t116Rating", initials: "ST", color: "pink" },
  { nameKey: "landing.t117Name", companyKey: "landing.t117Company", roleKey: "landing.t117Role", textKey: "landing.t117Text", ratingKey: "landing.t117Rating", initials: "HJ", color: "lime" },
  { nameKey: "landing.t118Name", companyKey: "landing.t118Company", roleKey: "landing.t118Role", textKey: "landing.t118Text", ratingKey: "landing.t118Rating", initials: "TM", color: "fuchsia" },
  { nameKey: "landing.t119Name", companyKey: "landing.t119Company", roleKey: "landing.t119Role", textKey: "landing.t119Text", ratingKey: "landing.t119Rating", initials: "AD", color: "red" },
  { nameKey: "landing.t120Name", companyKey: "landing.t120Company", roleKey: "landing.t120Role", textKey: "landing.t120Text", ratingKey: "landing.t120Rating", initials: "MF", color: "yellow" },
  { nameKey: "landing.t121Name", companyKey: "landing.t121Company", roleKey: "landing.t121Role", textKey: "landing.t121Text", ratingKey: "landing.t121Rating", initials: "VO", color: "sky" },
  { nameKey: "landing.t122Name", companyKey: "landing.t122Company", roleKey: "landing.t122Role", textKey: "landing.t122Text", ratingKey: "landing.t122Rating", initials: "JH", color: "emerald" },
  { nameKey: "landing.t123Name", companyKey: "landing.t123Company", roleKey: "landing.t123Role", textKey: "landing.t123Text", ratingKey: "landing.t123Rating", initials: "OK", color: "blue" },
  { nameKey: "landing.t124Name", companyKey: "landing.t124Company", roleKey: "landing.t124Role", textKey: "landing.t124Text", ratingKey: "landing.t124Rating", initials: "BK", color: "amber" },
  { nameKey: "landing.t125Name", companyKey: "landing.t125Company", roleKey: "landing.t125Role", textKey: "landing.t125Text", ratingKey: "landing.t125Rating", initials: "EV", color: "rose" },
  { nameKey: "landing.t126Name", companyKey: "landing.t126Company", roleKey: "landing.t126Role", textKey: "landing.t126Text", ratingKey: "landing.t126Rating", initials: "SL", color: "violet" },
  { nameKey: "landing.t127Name", companyKey: "landing.t127Company", roleKey: "landing.t127Role", textKey: "landing.t127Text", ratingKey: "landing.t127Rating", initials: "MR", color: "cyan" },
  { nameKey: "landing.t128Name", companyKey: "landing.t128Company", roleKey: "landing.t128Role", textKey: "landing.t128Text", ratingKey: "landing.t128Rating", initials: "AK", color: "orange" },
];

function TestimonialCard({ nameKey, companyKey, roleKey, textKey, ratingKey, initials, color }: any) {
  const { t } = useI18n();
  const rating = parseInt(t(ratingKey));
  const colorMap: Record<string, string> = {
    emerald: "bg-emerald-500/20 text-emerald-400",
    blue: "bg-blue-500/20 text-blue-400",
    amber: "bg-amber-500/20 text-amber-400",
    rose: "bg-rose-500/20 text-rose-400",
    violet: "bg-violet-500/20 text-violet-400",
    cyan: "bg-cyan-500/20 text-cyan-400",
    orange: "bg-orange-500/20 text-orange-400",
    teal: "bg-teal-500/20 text-teal-400",
    indigo: "bg-indigo-500/20 text-indigo-400",
    pink: "bg-pink-500/20 text-pink-400",
    lime: "bg-lime-500/20 text-lime-400",
    fuchsia: "bg-fuchsia-500/20 text-fuchsia-400",
    red: "bg-red-500/20 text-red-400",
    yellow: "bg-yellow-500/20 text-yellow-400",
    sky: "bg-sky-500/20 text-sky-400",
  };
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition flex flex-col">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${colorMap[color] || colorMap.emerald}`}>
          {initials}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-zinc-100 truncate">{t(nameKey)}</div>
          <div className="text-xs text-zinc-500 truncate">{t(roleKey)} · {t(companyKey)}</div>
        </div>
      </div>
      <div className="flex text-amber-400 text-xs mb-2">{"★".repeat(rating)}{"☆".repeat(5 - rating)}</div>
      <p className="text-sm text-zinc-400 leading-relaxed flex-1">{t(textKey)}</p>
    </div>
  );
}


