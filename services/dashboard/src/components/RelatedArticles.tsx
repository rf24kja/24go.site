import Link from "next/link";
import { getPublicBlogPosts } from "@/lib/api";

interface RelatedArticlesProps {
  slug: string;
  tags: string[];
  locale: string;
  translateTag: (tag: string, locale: string) => string;
}

/** Optional recommendations stream independently of the article body. */
export async function RelatedArticles({ slug, tags, locale, translateTag }: RelatedArticlesProps) {
  let posts: any[];
  try {
    const response = await getPublicBlogPosts(locale);
    const all = Array.isArray(response) ? response : response.items || [];
    const mine = new Set(tags);
    posts = all.filter((post: any) => post.slug !== slug)
      .map((post: any) => ({ post, shared: (post.tags || []).filter((tag: string) => mine.has(tag)).length }))
      .sort((a: any, b: any) => b.shared - a.shared)
      .slice(0, 3).map((item: any) => item.post);
  } catch {
    return null;
  }
  if (!posts.length) return null;
  return (
    <section aria-labelledby="related-articles-heading" className="mt-16 pt-8 border-t border-zinc-800/50">
      <h3 id="related-articles-heading" className="text-xl font-bold mb-6">{locale === "ru" ? "Другие статьи" : "More articles"}</h3>
      <div className="grid sm:grid-cols-3 gap-4 items-stretch">
        {posts.map((post: any) => (
          <Link key={post.slug} href={`/blog/${post.slug}?locale=${locale}`} className="min-w-0 flex flex-col bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition group">
            {post.tags?.[0] && <span className="text-xs text-emerald-400 font-medium">{translateTag(post.tags[0], locale)}</span>}
            <h4 className="text-sm font-semibold text-zinc-200 group-hover:text-emerald-400 transition mt-1 break-words">{post.title}</h4>
            <time className="text-xs text-zinc-500 mt-auto pt-3 block">{new Date(post.created_at).toLocaleDateString(locale === "ru" ? "ru-RU" : "en-US", { month: "short", day: "numeric" })}</time>
          </Link>
        ))}
      </div>
    </section>
  );
}
