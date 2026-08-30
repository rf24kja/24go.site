"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getPublicBlogPosts } from "@/lib/api";

type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  tags: string[];
  created_at: string;
};

export default function BlogPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [locale, setLocale] = useState<"en" | "ru">("en");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getPublicBlogPosts(locale)
      .then((res) => setPosts(Array.isArray(res) ? res : res.items || []))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, [locale]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800">
        <div className="max-w-3xl mx-auto px-6 py-6 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold">24<span className="text-emerald-400">GO</span></Link>
          <div className="flex gap-1 bg-zinc-800 rounded-lg p-1">
            <button onClick={() => setLocale("en")} className={`px-3 py-1 rounded text-xs font-medium transition ${locale === "en" ? "bg-zinc-700 text-zinc-100" : "text-zinc-400 hover:text-zinc-300"}`}>EN</button>
            <button onClick={() => setLocale("ru")} className={`px-3 py-1 rounded text-xs font-medium transition ${locale === "ru" ? "bg-zinc-700 text-zinc-100" : "text-zinc-400 hover:text-zinc-300"}`}>RU</button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-8">Blog</h1>

        {loading ? (
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-3 animate-pulse">
                <div className="h-5 bg-zinc-800 rounded w-2/3" />
                <div className="h-3 bg-zinc-800 rounded w-full" />
                <div className="h-3 bg-zinc-800 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <p className="text-zinc-500">No posts yet.</p>
        ) : (
          <div className="space-y-6">
            {posts.map((post) => (
              <Link key={post.id} href={`/blog/${post.slug}`}
                className="block bg-zinc-900 border border-zinc-800 rounded-xl p-6 hover:border-zinc-700 transition group">
                <h2 className="text-xl font-semibold text-zinc-100 group-hover:text-emerald-400 transition">{post.title}</h2>
                {post.excerpt && <p className="text-zinc-400 mt-2 line-clamp-2">{post.excerpt}</p>}
                <div className="flex items-center gap-3 mt-4">
                  <time className="text-xs text-zinc-500">{new Date(post.created_at).toLocaleDateString()}</time>
                  {post.tags?.map((tag) => (
                    <span key={tag} className="px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded text-xs">{tag}</span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
