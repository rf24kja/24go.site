import type { MetadataRoute } from "next";

const API = "https://api.24go.site";

async function getBlogPosts(): Promise<MetadataRoute.Sitemap> {
  try {
    const res = await fetch(`${API}/api/v1/blog?limit=100`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items || []).map((post: any) => ({
      url: `https://www.24go.site/blog/${post.slug}`,
      lastModified: new Date(post.created_at),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    }));
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://www.24go.site";

  const staticPages: MetadataRoute.Sitemap = [
    { url: base, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${base}/login`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/blog`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
  ];

  const blogPages = await getBlogPosts();

  return [...staticPages, ...blogPages];
}
