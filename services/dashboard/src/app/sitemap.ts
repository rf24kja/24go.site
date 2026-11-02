import type { MetadataRoute } from "next";

import { getAllPublicBlogPosts } from "@/lib/public-blog";
const BASE = "https://www.24go.site";
const LOCALES = ["en", "ru"] as const;

// Resolve the complete current inventory; never cache a partial fallback as success.
export const dynamic = "force-dynamic";

function languages(path: string) {
  const url = `${BASE}${path === "/" ? "" : path}`;
  return { en: `${url}?locale=en`, ru: `${url}?locale=ru`, "x-default": `${url}?locale=en` };
}

async function getBlogPosts(): Promise<MetadataRoute.Sitemap> {
  const items = await getAllPublicBlogPosts();
  return items.flatMap((post) => LOCALES.map((locale) => ({
    url: `${BASE}/blog/${post.slug}?locale=${locale}`,
    lastModified: new Date(post.updated_at || post.created_at),
    alternates: { languages: languages(`/blog/${post.slug}`) },
    changeFrequency: "monthly" as const,
    priority: 0.8,
  })));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPaths = [
    "/",
    "/blog",
    "/pricing",
    "/features",
    "/tools",

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

  // These tools have one English body, not two translated landing pages.
  const staticPages: MetadataRoute.Sitemap = [
    "/tools/roi-calculator",
    "/tools/group-analyzer",
    "/tools/account-checker",
  ].map(path => ({ url: `${BASE}${path}`, changeFrequency: "monthly", priority: 0.8 }));
  for (const path of staticPaths) {
    for (const locale of LOCALES) {
      const sep = path.includes("?") ? "&" : "?";
      staticPages.push({
        url: path === "/" ? `${BASE}?locale=${locale}` : `${BASE}${path}${sep}locale=${locale}`,
        alternates: { languages: languages(path) },
        changeFrequency: path === "/" ? "weekly" : "monthly",
        priority: path === "/" ? 1 : 0.8,
      });
    }
  }

  const blogPages = await getBlogPosts();

  return [...staticPages, ...blogPages];
}
