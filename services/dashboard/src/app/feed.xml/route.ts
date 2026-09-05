import { NextResponse } from "next/server";

const API = "https://api.24go.site";
const BASE = "https://www.24go.site";

export async function GET() {
  try {
    const res = await fetch(`${API}/api/v1/blog?limit=100`, { next: { revalidate: 3600 } });
    const data = await res.json();
    const posts = data.items || [];

    const items = posts.map((post: any) => {
      const pubDate = new Date(post.created_at).toUTCString();
      return `    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>${BASE}/blog/${post.slug}</link>
      <guid isPermaLink="true">${BASE}/blog/${post.slug}</guid>
      <description><![CDATA[${post.excerpt || post.meta_description || ""}]]></description>
      <pubDate>${pubDate}</pubDate>
      ${(post.tags || []).map((tag: string) => `      <category>${tag}</category>`).join("\n")}
    </item>`;
    }).join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>24GO Blog — Lead Generation & AI</title>
    <link>${BASE}/blog</link>
    <description>Articles about lead generation, Telegram automation, AI-powered sales, and B2B marketing.</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${BASE}/feed.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch {
    const empty = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>24GO Blog</title>
    <link>${BASE}/blog</link>
    <description>24GO Blog</description>
  </channel>
</rss>`;
    return new NextResponse(empty, {
      headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
    });
  }
}
