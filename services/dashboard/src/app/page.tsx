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
} from "lucide-react";

export default function LandingPage() {
  const [scrollY, setScrollY] = useState(0);
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
    </div>
  );
}

// ── Mockup Components ────────────────────────────────────────────

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


