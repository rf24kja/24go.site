"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { getPublicBlogPosts } from "@/lib/api";
import { Clock, Search, TrendingUp, BookOpen } from "lucide-react";

type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  tags: string[];
  created_at: string;
  reading_time?: number;
};

const CATEGORIES: Record<string, { en: string; ru: string; icon: string }> = {
  all: { en: "All", ru: "Все", icon: "📚" },
  telegram: { en: "Telegram", ru: "Telegram", icon: "✈️" },
  "lead-generation": { en: "Lead Gen", ru: "Лиды", icon: "🎯" },
  automation: { en: "Automation", ru: "Авто", icon: "⚙️" },
  b2b: { en: "B2B", ru: "B2B", icon: "🏢" },
  strategy: { en: "Strategy", ru: "Стратегия", icon: "🧭" },
  ai: { en: "AI", ru: "ИИ", icon: "🤖" },
  comparison: { en: "Compare", ru: "Сравнение", icon: "📊" },
};

const TAG_TO_CATEGORY: Record<string, string> = {
  telegram: "telegram", "telegram-bot": "telegram", outreach: "telegram", dm: "telegram",
  groups: "telegram", "cold-outreach": "telegram", warmup: "telegram", "multi-account": "telegram",
  proxy: "telegram", scraping: "telegram", "lead-extraction": "telegram", templates: "telegram",
  personalization: "telegram", "mass-outr": "telegram", messaging: "telegram",
  "lead-generation": "lead-generation", лидогенерация: "lead-generation", лиды: "lead-generation",
  "lead-magnet": "lead-generation", funnel: "lead-generation", "lead-qualification": "lead-generation",
  scoring: "lead-generation", intent: "lead-generation", qualification: "lead-generation",
  automation: "automation", автоматизация: "automation", bot: "automation", "auto-replies": "automation",
  scaling: "automation", масштабирование: "automation", masterclass: "automation",
  implementation: "automation", technical: "automation",
  b2b: "b2b", compliance: "b2b", GDPR: "b2b",
  strategy: "strategy", стратегия: "strategy", "sales-funnel": "strategy", conversion: "strategy",
  конверсия: "strategy", "market-research": "strategy", validation: "strategy", psychology: "strategy",
  guides: "strategy", guide: "strategy", "case-study": "strategy", marketing: "strategy",
  маркетинг: "strategy", optimization: "strategy",
  ai: "ai", ии: "ai", analytics: "ai", аналитика: "ai", roi: "ai",
  comparison: "comparison", сравнение: "comparison", vk: "comparison", email: "comparison",
  linkedin: "comparison",
};

function norm(s: string) { return s.toLowerCase().replace(/[^a-z0-9а-яё]/gi, ""); }

function getPostCategory(post: Post): string {
  for (const tag of post.tags || []) {
    const n = norm(tag);
    if (TAG_TO_CATEGORY[n]) return TAG_TO_CATEGORY[n];
    for (const [k, c] of Object.entries(TAG_TO_CATEGORY)) {
      if (n.includes(k) || k.includes(n)) return c;
    }
  }
  return "all";
}

function readingTime(text: string) { return Math.max(1, Math.ceil((text || "").split(/\s+/).length / 200)); }

function fmtDate(d: string, loc: string) {
  return new Date(d).toLocaleDateString(loc === "ru" ? "ru-RU" : "en-US", { year: "numeric", month: "short", day: "numeric" });
}

/* ── Locale switcher (renders in header) ────────────────────────── */
export function BlogLocaleSwitcher({ locale, setLocale }: { locale: string; setLocale: (l: "en" | "ru") => void }) {
  return (
    <div className="flex gap-0.5 bg-zinc-800 rounded-lg p-0.5">
      <button onClick={() => setLocale("en")} className={`px-3 py-1 rounded text-xs font-medium transition ${locale === "en" ? "bg-zinc-700 text-zinc-100" : "text-zinc-400 hover:text-zinc-300"}`}>EN</button>
      <button onClick={() => setLocale("ru")} className={`px-3 py-1 rounded text-xs font-medium transition ${locale === "ru" ? "bg-zinc-700 text-zinc-100" : "text-zinc-400 hover:text-zinc-300"}`}>RU</button>
    </div>
  );
}

/* ── Main blog content ──────────────────────────────────────────── */
export default function BlogContent({ initialPosts, initialLocale, archivePage }: { initialPosts: Post[]; initialLocale: string; archivePage?: number }) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [locale, setLocale] = useState<"en" | "ru">((initialLocale as "en" | "ru") || "en");
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCount, setShowCount] = useState(12);

  useEffect(() => {
    if (locale === initialLocale) return;
    setLoading(true);
    getPublicBlogPosts(locale)
      .then((res) => setPosts(Array.isArray(res) ? res : res.items || []))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, [locale, initialLocale]);

  const filteredPosts = useMemo(() => {
    let r = posts;
    if (activeCategory !== "all") r = r.filter((p) => getPostCategory(p) === activeCategory);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      r = r.filter((p) => p.title.toLowerCase().includes(q) || p.excerpt?.toLowerCase().includes(q) || p.tags?.some((t) => t.toLowerCase().includes(q)));
    }
    return r;
  }, [posts, activeCategory, searchQuery]);

  const filtering = activeCategory !== "all" || searchQuery.trim() !== "";
  const start = archivePage && !filtering ? (archivePage - 1) * 12 : 0;
  const visible = filteredPosts.slice(start, start + showCount);
  const hasMore = (!archivePage || filtering) && showCount < filteredPosts.length;

  const catCounts = useMemo(() => {
    const c: Record<string, number> = { all: posts.length };
    for (const p of posts) {
      const cat = getPostCategory(p);
      if (cat !== "all") c[cat] = (c[cat] || 0) + 1;
    }
    return c;
  }, [posts]);

  const featured = posts[start];

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="flex items-center justify-end mb-6">
        {archivePage ? <div className="flex gap-2">{["en", "ru"].map(language => <Link key={language} href={`/blog?locale=${language}&page=${archivePage}`} className="px-3 py-1 rounded text-xs font-medium bg-zinc-800">{language.toUpperCase()}</Link>)}</div> : <BlogLocaleSwitcher locale={locale} setLocale={setLocale} />}
      </div>
        {/* Featured */}
        {!loading && featured && activeCategory === "all" && !searchQuery && (
          <Link href={`/blog/${featured.slug}?locale=${locale}`} className="group block mb-10 bg-gradient-to-br from-zinc-900 via-zinc-900 to-emerald-950/20 border border-zinc-800 rounded-2xl p-4 sm:p-8 hover:border-emerald-500/30 transition-all duration-300">
            <div className="flex items-center gap-2 mb-4">
              <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-400 text-xs font-medium rounded-md border border-emerald-500/20">
                <TrendingUp className="w-3 h-3 inline mr-1" />{locale === "ru" ? "Популярное" : "Featured"}
              </span>
              {featured.tags?.[0] && <span className="px-2.5 py-0.5 bg-zinc-800 text-zinc-400 text-xs rounded-md">{featured.tags[0]}</span>}
            </div>
            <h2 className="text-2xl lg:text-3xl font-bold text-zinc-100 group-hover:text-emerald-400 transition mb-3">{featured.title}</h2>
            {featured.excerpt && <p className="text-zinc-400 text-base leading-relaxed max-w-3xl mb-4">{featured.excerpt}</p>}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-500">
              <time>{fmtDate(featured.created_at, locale)}</time>
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{featured.reading_time || readingTime(featured.excerpt)} {locale === "ru" ? "мин" : "min"}</span>
              <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" />{locale === "ru" ? "Читать" : "Read"}</span>
            </div>
          </Link>
        )}

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input type="text" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setShowCount(12); }}
            placeholder={locale === "ru" ? "Поиск статей..." : "Search articles..."}
            className="w-full pl-11 pr-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 transition" />
          {searchQuery && <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 text-xs">{locale === "ru" ? "Очистить" : "Clear"}</button>}
        </div>

        {/* Category tabs */}
        <div className="flex flex-wrap gap-2 mb-8">
          {Object.entries(CATEGORIES).map(([key, cat]) => {
            const count = catCounts[key] || 0;
            if (key !== "all" && count === 0) return null;
            return (
              <button key={key} onClick={() => { setActiveCategory(key); setShowCount(12); }}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${activeCategory === key ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" : "bg-zinc-900 text-zinc-400 border border-zinc-800 hover:border-zinc-700 hover:text-zinc-300"}`}>
                <span className="mr-1.5">{cat.icon}</span>{locale === "ru" ? cat.ru : cat.en}
                <span className="ml-1.5 text-xs opacity-60">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Count */}
        <p className="text-sm text-zinc-500 mb-6">
          {filteredPosts.length} {locale === "ru" ? "статей" : "articles"}
          {activeCategory !== "all" && <span> — {locale === "ru" ? CATEGORIES[activeCategory]?.ru : CATEGORIES[activeCategory]?.en}</span>}
          {searchQuery && <span> — &quot;{searchQuery}&quot;</span>}
        </p>

        {/* Grid */}
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1,2,3,4,5,6].map((i) => <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-3 animate-pulse"><div className="h-4 bg-zinc-800 rounded w-16"/><div className="h-6 bg-zinc-800 rounded w-3/4"/><div className="h-4 bg-zinc-800 rounded w-full"/></div>)}
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-zinc-500 text-lg mb-2">{locale === "ru" ? "Нет статей" : "No articles found"}</p>
            <p className="text-zinc-600 text-sm">{locale === "ru" ? "Попробуйте изменить фильтры" : "Try adjusting your filters"}</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {visible.map((post) => {
              const cat = getPostCategory(post);
              const ci = CATEGORIES[cat];
              return (
                <Link key={post.id} href={`/blog/${post.slug}?locale=${locale}`}
                  className="group block bg-zinc-900 border border-zinc-800 rounded-2xl p-6 hover:border-zinc-700 hover:bg-zinc-800/50 transition-all duration-200 flex flex-col">
                  <div className="flex items-center gap-2 mb-3">
                    {ci && cat !== "all" && <span className="text-xs">{ci.icon}</span>}
                    {post.tags?.slice(0, 2).map((t) => <span key={t} className="px-2 py-0.5 bg-zinc-800 text-zinc-500 text-[11px] rounded-md">{t}</span>)}
                  </div>
                  <h2 className="text-base font-semibold text-zinc-100 group-hover:text-emerald-400 transition leading-snug mb-2 flex-grow">{post.title}</h2>
                  {post.excerpt && <p className="text-sm text-zinc-500 line-clamp-2 leading-relaxed mb-4">{post.excerpt}</p>}
                  <div className="flex items-center gap-4 text-xs text-zinc-600 mt-auto pt-3 border-t border-zinc-800/50">
                    <time>{fmtDate(post.created_at, locale)}</time>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{post.reading_time || readingTime(post.excerpt)} {locale === "ru" ? "мин" : "min"}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {hasMore && (
          <div className="text-center mt-10">
            <button onClick={() => setShowCount((s) => s + 12)}
              className="px-8 py-3 bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-xl text-sm font-medium hover:border-zinc-700 hover:text-zinc-100 transition">
              {locale === "ru" ? "Показать ещё" : "Load More"} ({filteredPosts.length - showCount} {locale === "ru" ? "осталось" : "left"})
            </button>
          </div>
        )}
      </main>
  );
}
