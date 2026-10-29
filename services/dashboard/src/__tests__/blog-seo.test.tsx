import { afterEach, describe, expect, it, vi } from "vitest";
import sitemap from "@/app/sitemap";

const posts = Array.from({ length: 99 }, (_, i) => ({
  id: String(i), slug: `article-${i}`, title: `Article ${i}`, excerpt: "Summary",
  tags: ["telegram"], created_at: "2026-01-01T00:00:00Z",
}));
afterEach(() => { vi.unstubAllGlobals(); });

describe("blog SEO", () => {
  it("never returns a successful static-only sitemap for an HTTP failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 503, json: async () => ({ items: [], total: 0 }) })));
    await expect(sitemap()).rejects.toThrow();
  });

  it("rejects a repeated API page instead of inventing complete coverage", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ items: posts.slice(0, 40), total: 99 }) })));
    await expect(sitemap()).rejects.toThrow();
  });

  it("retries a transient transport error with a bounded timeout", async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error("network"))
      .mockResolvedValue({ ok: true, json: async () => ({ items: posts, total: 99 }) });
    vi.stubGlobal("fetch", fetcher);
    expect((await sitemap()).filter((entry) => entry.url.includes("/blog/article-"))).toHaveLength(198);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0][1].signal).toBeDefined();
  });
  it("sitemap follows API pagination and includes all 99 articles in both locales", async () => {
    const offsets: number[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      const offset = Number(url.searchParams.get("offset") || 0);
      offsets.push(offset);
      return { ok: true, json: async () => ({ items: posts.slice(offset, offset + 40), total: 99 }) };
    }));
    const entries = await sitemap();
    const articles = entries.filter((entry) => entry.url.includes("/blog/article-"));
    expect(articles).toHaveLength(198);
    expect(new Set(articles.map((entry) => entry.url)).size).toBe(198);
    expect(offsets).toEqual([0, 40, 80]);
  });
});
