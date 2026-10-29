import { afterEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

let language = "en";
vi.mock("@/lib/i18n", () => ({ useI18n: () => ({ lang: language, t: (key: string) => key, setLang: () => {} }) }));
vi.mock("@/components/LanguageSwitcher", () => ({ LanguageSwitcher: () => null }));
vi.mock("@/components/RelatedArticles", () => ({ RelatedArticles: () => null }));
vi.mock("@/components/motion/AnimatedSection", () => ({ AnimatedSection: ({ children }: any) => children }));
vi.mock("@/components/motion/MotionCard", () => ({ MotionCard: ({ children }: any) => children }));
vi.mock("@/components/magicui", () => ({ TextAnimate: ({ children }: any) => children }));
const post = { id: "1", slug: "sample", title: "Sample", excerpt: "Summary", content: "## Heading", tags: [], created_at: "2026-01-01" };
afterEach(() => vi.unstubAllGlobals());

const pages = import.meta.glob("../app/{features,pricing,tools,integrations,tutorials}/**/page.tsx");
const renderers = {
  ...pages,
  home: () => import("@/components/LandingPage"),
  archive: () => import("@/app/blog/page"),
  article: () => import("@/app/blog/[slug]/page"),
};
for (const locale of ["en", "ru"]) {
  for (const [name, load] of Object.entries(renderers)) {
    it(`${name} renders explicit ${locale} public navigation without changing private links`, async () => {
      language = locale;
      vi.stubGlobal("fetch", vi.fn(async (input: any) => ({ ok: true, json: async () => String(input).includes("/sample") ? post : { items: [post], total: 1 } })));
      const module: any = await load();
      const component = module.default || module.LandingPage;
      const html = renderToStaticMarkup(name === "home" ? createElement(component) : await component({ params: { slug: "sample" }, searchParams: { locale, page: "1" } }));
      const doc = new DOMParser().parseFromString(html, "text/html");
      const publicLinks = Array.from(doc.querySelectorAll("a[href]")).filter(a => !["EN", "RU"].includes(a.textContent?.trim() || "")).map(a => a.getAttribute("href")!).filter(href => {
        if (href.startsWith("#")) return false;
        const url = new URL(href, "https://www.24go.site");
        return url.origin === "https://www.24go.site" && /^\/(?:$|blog(?:\/|$)|features$|pricing$|tools(?:\/|$)|integrations(?:\/|$)|tutorials(?:\/|$))/.test(url.pathname);
      });
      expect(publicLinks.length).toBeGreaterThan(0);
      const missing = publicLinks.filter(href => {
        const url = new URL(href, "https://www.24go.site");
        // Intentional article language controls are the only cross-locale links here.
        return url.searchParams.get("locale") !== locale && !(name === "article" && /locale=(en|ru)$/.test(href) && url.pathname === "/blog/sample");
      });
      expect(missing).toEqual([]);
      doc.querySelectorAll('a[href^="/login"]').forEach(a => expect(a.getAttribute("href")).toBe("/login"));
    });
  }
}
