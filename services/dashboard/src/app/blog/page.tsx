import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getAllPublicBlogPosts } from "@/lib/public-blog";
import { notFound } from "next/navigation";
import BlogContent from "@/components/BlogList";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

function archivePage(value?: string): number {
  if (value !== undefined && (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)))) notFound();
  return Number(value || 1);
}

function archiveUrl(locale: string, page: number) {
  return `https://www.24go.site/blog?locale=${locale}${page > 1 ? `&page=${page}` : ""}`;
}

export async function generateMetadata({ searchParams }: { searchParams: { locale?: string; page?: string } }): Promise<Metadata> {
  const locale = searchParams?.locale === "ru" ? "ru" : "en";
  const page = archivePage(searchParams?.page);
  return {
    title: locale === "ru" ? "Блог — 24GO | Лидогенерация и автоматизация продаж" : "Blog — 24GO | Lead Generation & Sales Automation",
    description: locale === "ru"
      ? "Статьи о лидогенерации, автоматизации продаж и маркетинге в Telegram и ВКонтакте."
      : "Articles on lead generation, sales automation, and marketing in Telegram & VKontakte.",
    robots: "index, follow",
    alternates: {
      canonical: archiveUrl(locale, page),
      languages: { en: archiveUrl("en", page), ru: archiveUrl("ru", page), "x-default": archiveUrl("en", page) },
    },
  };
}

export default async function BlogPage({ searchParams }: { searchParams: { locale?: string; page?: string } }) {
  const locale = searchParams?.locale === "ru" ? "ru" : "en";
  const page = archivePage(searchParams?.page);
  const posts = await getAllPublicBlogPosts(locale);
  const pageCount = Math.max(1, Math.ceil(posts.length / 12));
  if (page > pageCount) notFound();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <section className="py-12 px-6 lg:px-12 bg-zinc-900/30">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <Link href={`/?locale=${locale}`} className="inline-flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight">24<span className="text-emerald-400">GO</span></span>
            </Link>
            <Suspense>
              <LanguageSwitcher />
            </Suspense>
          </div>
          <div className="text-center">
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
        </div>
      </section>

      <BlogContent key={`${locale}-${page}`} initialPosts={posts} initialLocale={locale} archivePage={page} />
      <nav aria-label={locale === "ru" ? "Страницы блога" : "Blog pages"} className="flex flex-wrap justify-center gap-3 pb-12">
        {Array.from({ length: pageCount }, (_, i) => i + 1).map(number => (
          <Link key={number} href={`/blog?locale=${locale}&page=${number}`} aria-current={number === page ? "page" : undefined} className="px-4 py-2 rounded-xl border border-zinc-800 hover:text-emerald-400">{number}</Link>
        ))}
      </nav>
    </div>
  );
}
