import { afterEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import sitemap from "@/app/sitemap";

const origin = "https://www.24go.site";
const created = "2026-01-01T00:00:00Z";
const updated = "2026-02-01T00:00:00Z";
function inventory() {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ total: 1, items: [{ slug: "fixture", created_at: created, updated_at: updated }] }))));
}
afterEach(() => vi.unstubAllGlobals());
it("does not invent modification dates for static pages", async () => {
  inventory();
  for (const item of await sitemap()) if (!item.url.includes("/blog/")) expect(item.lastModified).toBeUndefined();
});
it("uses the CMS update date for both localized article URLs", async () => {
  inventory();
  const entries = (await sitemap()).filter(item => item.url.includes("/blog/fixture?"));
  expect(entries).toHaveLength(2);
  for (const item of entries) expect(new Date(String(item.lastModified)).toISOString()).toBe(new Date(updated).toISOString());
});
it("falls back to the known creation date when no update timestamp exists", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ total: 1, items: [{ slug: "fixture", created_at: created, updated_at: null }] }))));
  for (const item of (await sitemap()).filter(item => item.url.includes("/blog/"))) expect(new Date(String(item.lastModified)).toISOString()).toBe(new Date(created).toISOString());
});
it("rejects an invalid CMS update timestamp instead of emitting broken XML dates", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ total: 1, items: [{ slug: "fixture", created_at: created, updated_at: "invalid" }] }))));
  await expect(sitemap()).rejects.toThrow();
});
it("does not turn an upstream outage into a successful static-only sitemap", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("unavailable", { status: 503 })));
  await expect(sitemap()).rejects.toThrow();
});
it("advertises reciprocal translated URLs without fictitious tool locales", async () => {
  inventory();
  const entries = await sitemap();
  for (const item of entries.filter(item => item.url.includes("?locale="))) {
    const languages = item.alternates?.languages;
    expect(languages?.en).toBe(item.url.replace(/locale=(en|ru)/, "locale=en"));
    expect(languages?.ru).toBe(item.url.replace(/locale=(en|ru)/, "locale=ru"));
    expect(languages?.["x-default"]).toBe(languages?.en);
  }
  for (const tool of ["roi-calculator", "group-analyzer", "account-checker"]) {
    const entry = entries.find(item => item.url === `${origin}/tools/${tool}`)!;
    expect(entry).toBeDefined();
    expect(entry.alternates?.languages?.ru).toBeUndefined();
  }
});
it("keeps private roots, subpaths, locale queries and namespaces out of crawl scope", () => {
  const robots = readFileSync(path.resolve("public/robots.txt"), "utf8");
  const rules = robots.split(/\r?\n/).map(line => line.match(/^(Allow|Disallow):\s*(\S+)/i)).filter(Boolean).map(match => ({ allow: match![1].toLowerCase() === "allow", prefix: match![2] }));
  const allowed = (url: string) => rules.filter(rule => url.startsWith(rule.prefix)).sort((a,b) => b.prefix.length-a.prefix.length || Number(b.allow)-Number(a.allow))[0]?.allow ?? true;
  for (const prefix of ["/api", "/accounts", "/leads", "/settings", "/billing", "/targets", "/blog-admin", "/users", "/audit", "/health", "/TG", "/VK", "/WA", "/FB", "/MAX"]) {
    for (const suffix of ["", "/", "?locale=ru", "/nested?locale=en"]) expect(allowed(prefix+suffix),prefix+suffix).toBe(false);
  }
  for (const url of ["/", "/?locale=ru", "/blog?locale=en&page=2", "/blog/fixture?locale=ru", "/features?locale=en", "/_next/static/example.js", "/llms.txt"]) expect(allowed(url),url).toBe(true);
  expect(robots).toMatch(/^Sitemap: https:\/\/www\.24go\.site\/sitemap\.xml$/m);
});
