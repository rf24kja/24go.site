import Link from "next/link";
import { getPublicBlogPost, getBlogSlugs } from "@/lib/api";
import type { Metadata } from "next";

// ponytail: minimal markdown→HTML, no dependency. Covers bold, italic, headings, lists, links, paragraphs.
function md(text: string): string {
  return text
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-emerald-400 hover:underline">$1</a>')
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/((?:<li>.*<\/li>\n?)+)/g, "<ul class=\"list-disc pl-5 space-y-1\">$1</ul>")
    .split("\n\n").map((p) => {
      const trimmed = p.trim();
      if (!trimmed) return "";
      if (trimmed.startsWith("<h") || trimmed.startsWith("<ul") || trimmed.startsWith("<li")) return trimmed;
      return "<p>" + trimmed.replace(/\n/g, "<br/>") + "</p>";
    }).join("\n");
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
  const locale = searchParams?.locale || "en";
  try {
    const post = await getPublicBlogPost(params.slug, locale);
    return {
      title: post.title,
      description: post.meta_description || post.excerpt || "",
      openGraph: { title: post.title, description: post.excerpt || "", type: "article" },
    };
  } catch {
    return { title: "Blog Post" };
  }
}

export default async function BlogPostPage({ params, searchParams }: Props) {
  const locale = searchParams?.locale || "en";
  let post: any;
  try {
    post = await getPublicBlogPost(params.slug, locale);
  } catch {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-400 mb-4">Post not found.</p>
          <Link href="/blog" className="text-emerald-400 hover:underline">Back to blog</Link>
        </div>
      </div>
    );
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt || "",
    datePublished: post.created_at,
    author: { "@type": "Organization", name: "24GO" },
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className="border-b border-zinc-800">
        <div className="max-w-3xl mx-auto px-6 py-6 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold">24<span className="text-emerald-400">GO</span></Link>
          <Link href="/blog" className="text-sm text-zinc-400 hover:text-zinc-200 transition">Blog</Link>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-4">{post.title}</h1>
        <div className="flex items-center gap-3 mb-8">
          <time className="text-sm text-zinc-500">{new Date(post.created_at).toLocaleDateString()}</time>
          {post.tags?.map((tag: string) => (
            <span key={tag} className="px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded text-xs">{tag}</span>
          ))}
        </div>

        {post.excerpt && <p className="text-zinc-400 text-lg mb-8 leading-relaxed">{post.excerpt}</p>}

        <div className="prose prose-invert max-w-none text-zinc-300 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: md(post.content || "") }} />
      </article>
    </div>
  );
}
