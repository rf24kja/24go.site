"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getPublicBlogPosts } from "@/lib/api";
import { Clock, Tag } from "lucide-react";

const TAG_MAP: Record<string, { en: string; ru: string }> = {
  "инструкция": { en: "guide", ru: "инструкция" },
  "тарифы": { en: "pricing", ru: "тарифы" },
  "парсинг": { en: "scraping", ru: "парсинг" },
  "telegram": { en: "Telegram", ru: "Telegram" },
  "вконтакте": { en: "VKontakte", ru: "ВКонтакте" },
  "b2b": { en: "B2B", ru: "B2B" },
  "сравнение": { en: "comparison", ru: "сравнение" },
  "лидогенерация": { en: "lead generation", ru: "лидогенерация" },
  "маркетинг": { en: "marketing", ru: "маркетинг" },
  "автоматизация": { en: "automation", ru: "автоматизация" },
  "ии": { en: "AI", ru: "ИИ" },
  "прогрев": { en: "warming", ru: "прогрев" },
  "рассылка": { en: "mailings", ru: "рассылка" },
  "crm": { en: "CRM", ru: "CRM" },
  "аналитика": { en: "analytics", ru: "аналитика" },
  "кампании": { en: "campaigns", ru: "кампании" },
  "прокси": { en: "proxies", ru: "прокси" },
  "автоответы": { en: "auto-replies", ru: "автоответы" },
  "правила лидов": { en: "lead rules", ru: "правила лидов" },
  "поиск групп": { en: "group discovery", ru: "поиск групп" },
};

function tTag(tag: string, locale: string): string {
  const key = tag.toLowerCase();
  return TAG_MAP[key]?.[locale as "en" | "ru"] || tag;
}

type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  tags: string[];
  created_at: string;
  reading_time?: number;
};

function readingTime(text: string): number {
  return Math.max(1, Math.ceil((text || "").split(/\s+/).length / 200));
}

export default function BlogList({ initialPosts, initialLocale }: { initialPosts: Post[]; initialLocale: string }) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [locale, setLocale] = useState<"en" | "ru">((initialLocale as "en" | "ru") || "en");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (locale === initialLocale) return;
    setLoading(true);
    getPublicBlogPosts(locale)
      .then((res) => setPosts(Array.isArray(res) ? res : res.items || []))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, [locale, initialLocale]);

  return (
    <>
      <div className="flex gap-0.5 bg-zinc-800 rounded-lg p-0.5">
        <button onClick={() => setLocale("en")} className={`px-3 py-1 rounded text-xs font-medium transition ${locale === "en" ? "bg-zinc-700 text-zinc-100" : "text-zinc-400 hover:text-zinc-300"}`}>EN</button>
        <button onClick={() => setLocale("ru")} className={`px-3 py-1 rounded text-xs font-medium transition ${locale === "ru" ? "bg-zinc-700 text-zinc-100" : "text-zinc-400 hover:text-zinc-300"}`}>RU</button>
      </div>

      <main className="max-w-5xl mx-auto px-6 py-12">
        {loading ? (
          <div className="grid sm:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-3 animate-pulse">
                <div className="h-4 bg-zinc-800 rounded w-16" />
                <div className="h-6 bg-zinc-800 rounded w-3/4" />
                <div className="h-4 bg-zinc-800 rounded w-full" />
                <div className="h-4 bg-zinc-800 rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-zinc-500 text-lg">
              {locale === "ru" ? "Нет статей" : "No articles yet"}
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-6">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/blog/${post.slug}?locale=${locale}`}
                className="group block bg-zinc-900 border border-zinc-800 rounded-2xl p-6 hover:border-zinc-700 hover:bg-zinc-800/50 transition-all duration-200"
              >
                {post.tags?.[0] && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-500/10 text-emerald-400 text-xs font-medium rounded-md border border-emerald-500/20 mb-3">
                    <Tag className="w-3 h-3" />
                    {tTag(post.tags[0], locale)}
                  </span>
                )}
                <h2 className="text-lg font-semibold text-zinc-100 group-hover:text-emerald-400 transition leading-snug mb-2">
                  {post.title}
                </h2>
                {post.excerpt && (
                  <p className="text-sm text-zinc-500 line-clamp-3 leading-relaxed mb-4">
                    {post.excerpt}
                  </p>
                )}
                <div className="flex items-center gap-4 text-xs text-zinc-600">
                  <time>{new Date(post.created_at).toLocaleDateString(locale === "ru" ? "ru-RU" : "en-US", { year: "numeric", month: "short", day: "numeric" })}</time>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {post.reading_time || readingTime(post.excerpt)} {locale === "ru" ? "мин" : "min"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
