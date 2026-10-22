import { NextResponse } from "next/server";

const API = "https://api.24go.site";
const BASE = "https://www.24go.site";
const LOCALES = ["en", "ru"] as const;

// ponytail: ISR via Cache-Control — new articles enter the sitemap within an hour, no redeploy needed
const STATIC_PATHS = ["/", "/blog", "/pricing", "/features", "/tools", "/tools/roi-calculator", "/tools/group-analyzer", "/tools/account-checker", "/integrations/amo-crm", "/integrations/google-sheets", "/integrations/hubspot", "/integrations/bitrix24", "/integrations/webhook", "/tutorials/telegram-auto-reply", "/tutorials/telegram-lead-scraping", "/tutorials/telegram-warmup", "/privacy", "/terms"];

function buildAlternatesXml(path: string): string {
  const alternates: Record<string, string> =
    path === "/"
      ? { en: `${BASE}?locale=en`, ru: `${BASE}?locale=ru`, "x-default": BASE }
      : { en: `${BASE}${path}?locale=en`, ru: `${BASE}${path}?locale=ru`, "x-default": `${BASE}${path}?locale=en` };
  return Object.entries(alternates)
    .map(([lang, url]) => `    <xhtml:link rel="alternate" hreflang="${lang}" href="${url}" />`)
    .join("\n");
}

function escapeXml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function GET() {
  try {
    let blogPosts: any[] = [];
    try {
      const res = await fetch(`${API}/api/v1/blog?limit=200`, { next: { revalidate: 3600 } });
      if (res.ok) {
        const data = await res.json();
        blogPosts = data.items || [];
      }
    } catch {
      // API unreachable — sitemap still serves static pages
    }

    const now = new Date().toISOString().split(".")[0] + "Z";
    let urls = "";

    for (const path of STATIC_PATHS) {
      const alternatesXml = buildAlternatesXml(path);
      for (const locale of LOCALES) {
        const url = path === "/" ? `${BASE}?locale=${locale}` : `${BASE}${path}?locale=${locale}`;
        const isHomepage = path === "/";
        urls += `  <url>\n    <loc>${escapeXml(url)}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>${isHomepage ? "weekly" : "monthly"}</changefreq>\n    <priority>${isHomepage ? "1.0" : "0.8"}</priority>\n${alternatesXml}\n  </url>\n`;
      }
    }

    for (const post of blogPosts) {
      const postPath = `/blog/${post.slug}`;
      const alternatesXml = buildAlternatesXml(postPath);
      const lastmod = new Date(post.created_at).toISOString().split(".")[0] + "Z";
      for (const locale of LOCALES) {
        const url = `${BASE}/blog/${post.slug}?locale=${locale}`;
        urls += `  <url>\n    <loc>${escapeXml(url)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n${alternatesXml}\n  </url>\n`;
      }
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}</urlset>`;

    return new NextResponse(xml, {
      headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch {
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
