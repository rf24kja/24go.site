import type { Metadata } from "next";
import Link from "next/link";
import { getPublicBlogPosts } from "@/lib/api";
import BlogList from "@/components/BlogList";

export async function generateMetadata({ searchParams }: { searchParams: { locale?: string } }): Promise<Metadata> {
  const locale = searchParams?.locale === "ru" ? "ru" : "en";
  return {
    title: locale === "ru" ? "Блог — 24GO | Лидогенерация и автоматизация продаж" : "Blog — 24GO | Lead Generation & Sales Automation",
    description: locale === "ru"
      ? "Статьи о лидогенерации, автоматизации продаж и маркетинге в Telegram и ВКонтакте. Практические гайды, кейсы и сравнения инструментов."
      : "Articles on lead generation, sales automation, and marketing in Telegram & VKontakte. Practical guides, case studies, and tool comparisons.",
    robots: "index, follow",
    alternates: {
      canonical: "https://www.24go.site/blog",
      languages: {
        en: "https://www.24go.site/blog?locale=en",
        ru: "https://www.24go.site/blog?locale=ru",
        "x-default": "https://www.24go.site/blog?locale=en",
      },
    },
  };
}

export default async function BlogPage({ searchParams }: { searchParams: { locale?: string } }) {
  const locale = searchParams?.locale === "ru" ? "ru" : "en";

  let posts: any[] = [];
  try {
    const res = await getPublicBlogPosts(locale);
    posts = Array.isArray(res) ? res : res.items || [];
  } catch {}

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight">24<span className="text-emerald-400">GO</span></span>
          </Link>
          <BlogList initialPosts={posts} initialLocale={locale} />
        </div>
      </header>

      <section className="py-16 px-6 lg:px-12 border-b border-zinc-800/50 bg-zinc-900/30">
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="text-4xl lg:text-5xl font-bold mb-4">
            {locale === "ru" ? "Блог" : "Blog"}
          </h1>
          <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
            {locale === "ru"
              ? "Статьи о лидогенерации, автоматизации продаж и маркетинге в Telegram и ВКонтакте"
              : "Articles on lead generation, sales automation, and marketing in Telegram & VKontakte"}
          </p>
          {posts.length > 0 && (
            <p className="text-sm text-zinc-500 mt-3">
              {posts.length} {locale === "ru" ? "статей" : "articles"}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
