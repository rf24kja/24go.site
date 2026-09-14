import type { MetadataRoute } from "next";

const API = "https://api.24go.site";
const BASE = "https://www.24go.site";
const LOCALES = ["en", "ru"] as const;

async function getBlogPosts(): Promise<MetadataRoute.Sitemap> {
  try {
    const res = await fetch(`${API}/api/v1/blog?limit=100`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json();
    const posts: MetadataRoute.Sitemap = [];
    for (const post of data.items || []) {
      for (const locale of LOCALES) {
        posts.push({
          url: `${BASE}/blog/${post.slug}?locale=${locale}`,
          lastModified: new Date(post.created_at),
          changeFrequency: "monthly" as const,
          priority: 0.8,
        });
      }
    }
    return posts;
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPaths = [
    "/",
    "/blog",
    "/pricing",
    "/features",
    "/tools",
    "/tools/roi-calculator",
    "/tools/group-analyzer",
    "/tools/account-checker",
    "/integrations/amo-crm",
    "/integrations/google-sheets",
    "/integrations/hubspot",
    "/integrations/bitrix24",
    "/integrations/webhook",
    "/tutorials/telegram-auto-reply",
    "/tutorials/telegram-lead-scraping",
    "/tutorials/telegram-warmup",
  ];

  const staticPages: MetadataRoute.Sitemap = [];
  for (const path of staticPaths) {
    for (const locale of LOCALES) {
      const sep = path.includes("?") ? "&" : "?";
      staticPages.push({
        url: path === "/" ? `${BASE}?locale=${locale}` : `${BASE}${path}${sep}locale=${locale}`,
        lastModified: new Date(),
        changeFrequency: path === "/" ? "weekly" : "monthly",
        priority: path === "/" ? 1 : 0.8,
      });
    }
  }

  const blogPages = await getBlogPosts();

  return [...staticPages, ...blogPages];
}
