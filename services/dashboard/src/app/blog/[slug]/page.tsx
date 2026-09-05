import Link from "next/link";
import { getPublicBlogPost, getBlogSlugs, getPublicBlogPosts } from "@/lib/api";
import type { Metadata } from "next";
import { ArrowLeft, Clock, Tag } from "lucide-react";

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

// ponytail: minimal markdown→HTML, no dependency. Supports tables, images, code, blockquotes.
function md(text: string): string {
  if (!text) return "";

  // Normalize line endings
  let html = text.replace(/\r\n/g, "\n");

  // Code blocks: ```lang\n...\n``` → <pre><code>...</code></pre>
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang, code) => {
    const escaped = code.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return `<pre class="bg-zinc-950 border border-zinc-800 rounded-xl p-4 my-4 overflow-x-auto text-sm"><code class="text-zinc-300">${escaped}</code></pre>`;
  });

  // Inline code: `code` → <code>code</code>
  html = html.replace(/`([^`]+)`/g, '<code class="bg-zinc-800 text-emerald-400 px-1.5 py-0.5 rounded text-sm">$1</code>');

  // Images: ![alt](url) → <img>
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="rounded-xl border border-zinc-800 my-6 max-w-full" loading="lazy" />');

  // Tables
  html = html.replace(/^(\|.+\|)\n(\|[-| :]+\|)\n((?:\|.+\|\n?)+)/gm, (_m, header, _sep, body) => {
    const headers = header.split("|").filter((c: string) => c.trim());
    const rows = body.trim().split("\n").map((r: string) => r.split("|").filter((c: string) => c.trim()));
    const ths = headers.map((h: string) => `<th class="px-4 py-2 text-left text-sm font-medium text-zinc-300 bg-zinc-800/50 border-b border-zinc-700">${h.trim()}</th>`).join("");
    const trs = rows.map((cells: string[]) => {
      const tds = cells.map((c: string) => `<td class="px-4 py-2 text-sm text-zinc-400 border-b border-zinc-800/50">${c.trim()}</td>`).join("");
      return `<tr>${tds}</tr>`;
    }).join("");
    return `<div class="overflow-x-auto my-6"><table class="w-full border border-zinc-800 rounded-xl overflow-hidden"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></div>`;
  });

  // Blockquotes: > text → <blockquote>
  html = html.replace(/^(?:> .+\n?)+/gm, (block) => {
    const inner = block.replace(/^> /gm, "").trim();
    return `<blockquote class="border-l-4 border-emerald-500/50 pl-4 py-2 my-4 text-zinc-400 italic bg-emerald-500/5 rounded-r-lg">${inner.replace(/\n/g, "<br/>")}</blockquote>`;
  });

  // Horizontal rules: --- or *** or ___
  html = html.replace(/^[-*_]{3,}$/gm, '<hr class="border-zinc-800 my-8" />');

  // Standard markdown elements
  html = html
    .replace(/^### (.+)$/gm, '<h3 class="text-xl font-bold text-zinc-100 mt-8 mb-3">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-2xl font-bold text-zinc-100 mt-10 mb-4 pb-2 border-b border-zinc-800">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-3xl font-bold text-zinc-100 mb-6">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-zinc-200 font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\[(.+?)\]\(([^)]+)\)/g, '<a href="$2" class="text-emerald-400 hover:underline">$1</a>')
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul class="list-disc pl-5 space-y-1 my-3">$1</ul>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="list-decimal">$2</li>')
    .split("\n\n").map((p) => {
      const trimmed = p.trim();
      if (!trimmed) return "";
      if (trimmed.startsWith("<h") || trimmed.startsWith("<ul") || trimmed.startsWith("<li") ||
          trimmed.startsWith("<pre") || trimmed.startsWith("<blockquote") || trimmed.startsWith("<table") ||
          trimmed.startsWith("<div") || trimmed.startsWith("<hr") || trimmed.startsWith("<img") || trimmed.startsWith("<code")) return trimmed;
      return "<p class='text-zinc-400 leading-relaxed my-3'>" + trimmed.replace(/\n/g, "<br/>") + "</p>";
    }).join("\n");

  return html;
}

function readingTime(text: string): number {
  return Math.max(1, Math.ceil((text || "").split(/\s+/).length / 200));
}

type Props = { params: { slug: string }; searchParams: { locale?: string } };

export async function generateStaticParams() {
  try {
    const slugs = await getBlogSlugs();
    return (slugs || []).map((s: any) => ({ slug: s.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const locale = searchParams?.locale === "ru" ? "ru" : "en";
  try {
    const post = await getPublicBlogPost(params.slug, locale);
    return {
      title: `${post.title} — 24GO Blog`,
      description: post.meta_description || post.excerpt || "",
      openGraph: {
        title: post.title,
        description: post.excerpt || "",
        type: "article",
        publishedTime: post.created_at,
        tags: post.tags,
      },
    };
  } catch {
    return { title: "Blog Post — 24GO" };
  }
}

export default async function BlogPostPage({ params, searchParams }: Props) {
  const locale = searchParams?.locale === "ru" ? "ru" : "en";
  const labels = locale === "ru"
    ? { back: "Назад к блогу", readTime: "мин чтения", published: "Опубликовано", related: "Другие статьи", noRelated: "Статья не найдена" }
    : { back: "Back to blog", readTime: "min read", published: "Published", related: "More articles", noRelated: "Post not found" };

  let post: any;
  try {
    post = await getPublicBlogPost(params.slug, locale);
  } catch {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-400 mb-4">{labels.noRelated}</p>
          <Link href="/blog" className="text-emerald-400 hover:underline">{labels.back}</Link>
        </div>
      </div>
    );
  }

  // Fetch related posts
  let relatedPosts: any[] = [];
  try {
    const res = await getPublicBlogPosts(locale);
    const all = Array.isArray(res) ? res : res.items || [];
    relatedPosts = all
      .filter((p: any) => p.slug !== params.slug)
      .slice(0, 3);
  } catch {}

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt || "",
    datePublished: post.created_at,
    author: { "@type": "Organization", name: "24GO" },
    publisher: { "@type": "Organization", name: "24GO" },
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold tracking-tight">24<span className="text-emerald-400">GO</span></Link>
          <div className="flex items-center gap-3">
            <div className="flex gap-0.5 bg-zinc-800 rounded-lg p-0.5">
              <a href={`/blog/${params.slug}?locale=en`}
                className={`px-2 py-1 rounded text-xs font-medium transition ${locale === "en" ? "bg-zinc-700 text-zinc-100" : "text-zinc-400 hover:text-zinc-300"}`}>EN</a>
              <a href={`/blog/${params.slug}?locale=ru`}
                className={`px-2 py-1 rounded text-xs font-medium transition ${locale === "ru" ? "bg-zinc-700 text-zinc-100" : "text-zinc-400 hover:text-zinc-300"}`}>RU</a>
            </div>
            <Link href="/blog" className="text-sm text-zinc-400 hover:text-zinc-200 transition flex items-center gap-1.5">
              <ArrowLeft className="w-4 h-4" />
              {labels.back}
            </Link>
          </div>
        </div>
      </header>

      {/* Breadcrumbs */}
      <div className="max-w-4xl mx-auto px-6 py-4">
        <nav className="flex items-center gap-2 text-sm text-zinc-500">
          <Link href="/" className="hover:text-zinc-300 transition">24GO</Link>
          <span>/</span>
          <Link href="/blog" className="hover:text-zinc-300 transition">Blog</Link>
          <span>/</span>
          <span className="text-zinc-300 truncate max-w-[200px]">{post.title}</span>
        </nav>
      </div>

      {/* Article */}
      <article className="max-w-4xl mx-auto px-6 pb-20">
        <div className="max-w-3xl">
          {/* Tags */}
          {post.tags?.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {post.tags.map((tag: string) => (
                <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-500/10 text-emerald-400 text-xs font-medium rounded-md border border-emerald-500/20">
                  <Tag className="w-3 h-3" />
                  {tTag(tag, locale)}
                </span>
              ))}
            </div>
          )}

          <h1 className="text-3xl lg:text-4xl font-bold mb-4 leading-tight">{post.title}</h1>

          <div className="flex items-center gap-4 text-sm text-zinc-500 mb-8">
            <time>{new Date(post.created_at).toLocaleDateString(locale === "ru" ? "ru-RU" : "en-US", { year: "numeric", month: "long", day: "numeric" })}</time>
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              {readingTime(post.content || "")} {labels.readTime}
            </span>
          </div>

          {post.excerpt && (
            <p className="text-zinc-400 text-lg mb-8 leading-relaxed border-l-2 border-emerald-500/30 pl-4">
              {post.excerpt}
            </p>
          )}

          <div className="prose prose-invert max-w-none text-zinc-300 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: md(post.content || "") }} />
        </div>

        {/* Related articles */}
        {relatedPosts.length > 0 && (
          <div className="mt-16 pt-8 border-t border-zinc-800/50">
            <h3 className="text-xl font-bold mb-6">{labels.related}</h3>
            <div className="grid sm:grid-cols-3 gap-4">
              {relatedPosts.map((rp: any) => (
                <Link
                  key={rp.slug}
                  href={`/blog/${rp.slug}?locale=${locale}`}
                  className="block bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition group"
                >
                  {rp.tags?.[0] && (
                    <span className="text-xs text-emerald-400 font-medium">{tTag(rp.tags[0], locale)}</span>
                  )}
                  <h4 className="text-sm font-semibold text-zinc-200 group-hover:text-emerald-400 transition mt-1 line-clamp-2">{rp.title}</h4>
                  <time className="text-xs text-zinc-600 mt-2 block">
                    {new Date(rp.created_at).toLocaleDateString(locale === "ru" ? "ru-RU" : "en-US", { month: "short", day: "numeric" })}
                  </time>
                </Link>
              ))}
            </div>
          </div>
        )}
      </article>
    </div>
  );
}
