import type { MetadataRoute } from "next";

const API = "https://api.24go.site";
const BASE = "https://www.24go.site";
const LOCALES = ["en", "ru"] as const;

// ponytail: ISR, not build-time — new articles enter the sitemap within an hour, no redeploy needed
export const revalidate = 3600;

// Build xhtml:link language alternates for a given page path.
// For the homepage x-default points to the root without locale; for all other
// paths it points to the EN locale variant.
function buildAlternates(path: string): Record<string, string> {
  if (path === "/") {
    return {
      en: `${BASE}?locale=en`,
      ru: `${BASE}?locale=ru`,
      "x-default": BASE,
    };
  }
  return {
    en: `${BASE}${path}?locale=en`,
    ru: `${BASE}${path}?locale=ru`,
    "x-default": `${BASE}${path}?locale=en`,
  };
}

async function getBlogPosts(): Promise<MetadataRoute.Sitemap> {
  try {
    const res = await fetch(`${API}/api/v1/blog?limit=200`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json();
    const posts: MetadataRoute.Sitemap = [];
    for (const post of data.items || []) {
      const alternates = buildAlternates(`/blog/${post.slug}`);
      for (const locale of LOCALES) {
        posts.push({
          url: `${BASE}/blog/${post.slug}?locale=${locale}`,
          lastModified: new Date(post.created_at),
          changeFrequency: "monthly" as const,
          priority: 0.8,
          alternates: { languages: alternates },
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
    "/privacy",
    "/terms",
  ];

  const staticPages: MetadataRoute.Sitemap = [];
  for (const path of staticPaths) {
    const alternates = buildAlternates(path);
    for (const locale of LOCALES) {
      const sep = path.includes("?") ? "&" : "?";
      staticPages.push({
        url: path === "/" ? `${BASE}?locale=${locale}` : `${BASE}${path}${sep}locale=${locale}`,
        lastModified: new Date(),
        changeFrequency: path === "/" ? "weekly" : "monthly",
        priority: path === "/" ? 1 : 0.8,
        alternates: { languages: alternates },
      });
    }
  }

  const blogPages = await getBlogPosts();

  return [...staticPages, ...blogPages];
}
