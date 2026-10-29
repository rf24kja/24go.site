import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { cleanup, fireEvent, render } from "@testing-library/react";
import BlogPage, { generateMetadata } from "@/app/blog/page";

vi.mock("@/components/LanguageSwitcher", () => ({ LanguageSwitcher: () => null }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));
const posts = Array.from({ length: 99 }, (_, i) => ({
  id: String(i), slug: `article-${i}`, title: `Article ${i}`, excerpt: "Summary",
  tags: ["telegram"], created_at: "2026-01-01T00:00:00Z",
}));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("crawlable blog archive", () => {
  it("keeps search across the whole archive rather than only the current page", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ items: posts, total: 99 }) })));
    const view = render(await BlogPage({ searchParams: { locale: "en", page: "2" } }));
    expect(view.queryByText("Article 98")).toBeNull();
    fireEvent.change(view.getByPlaceholderText("Search articles..."), { target: { value: "Article 98" } });
    expect(view.getByText("Article 98")).toBeTruthy();
  });

  it("links every article across server-rendered numbered pages, preserving locale", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ items: posts, total: 99 }) })));
    for (const locale of ["en", "ru"]) {
      const found = new Set<string>();
      for (let page = 1; page <= 9; page++) {
        const html = renderToStaticMarkup(await BlogPage({ searchParams: { locale, page: String(page) } } as any));
        const doc = new DOMParser().parseFromString(html, "text/html");
        doc.querySelectorAll('a[href^="/blog/article-"]').forEach(a => found.add(a.getAttribute("href")!));
        const hrefs = Array.from(doc.querySelectorAll("a")).map(a => a.getAttribute("href"));
        expect(hrefs).toContain(`/blog?locale=${locale}&page=${page === 9 ? 8 : page + 1}`);
        expect(hrefs).toContain(`/blog?locale=${locale === "en" ? "ru" : "en"}&page=${page}`);
      }
      expect(found.size).toBe(99);
    }
  });

  it("gives page 2 its own canonical and locale alternates", async () => {
    const metadata = await generateMetadata({ searchParams: { locale: "ru", page: "2" } } as any);
    expect(metadata.alternates?.canonical).toBe("https://www.24go.site/blog?locale=ru&page=2");
    expect(metadata.alternates?.languages?.en).toBe("https://www.24go.site/blog?locale=en&page=2");
  });

  it("rejects out-of-range archive pages rather than returning empty indexable HTML", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ items: posts, total: 99 }) })));
    await expect(BlogPage({ searchParams: { locale: "en", page: "100" } } as any)).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
