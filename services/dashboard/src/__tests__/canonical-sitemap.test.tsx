import { afterEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import sitemap from "@/app/sitemap";

const tools = import.meta.glob("../app/tools/*/page.tsx");
afterEach(() => vi.unstubAllGlobals());
for (const [name, load] of Object.entries(tools)) {
  const path = name.replace("../app", "").replace("/page.tsx", "");
  it(`${path} is English-only and must not advertise fictitious Russian alternates`, async () => {
    const page: any = await load();
    const bare = `https://www.24go.site${path}`;
    expect(page.metadata.alternates).toEqual({ canonical: bare, languages: { en: bare, "x-default": bare } });
    for (const locale of ["en", "ru"]) {
      const html = renderToStaticMarkup(await page.default({ searchParams: { locale } }));
      const doc = new DOMParser().parseFromString(html, "text/html");
      expect(doc.querySelector("h1")?.textContent).not.toMatch(/[А-Яа-я]/);
    }
  });
}
it("lists only canonical tool URLs, while retaining both already translated legal documents", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ items: [], total: 0 }))));
  const urls = (await sitemap()).map(item => item.url);
  for (const name of Object.keys(tools)) {
    const bare = `https://www.24go.site${name.replace("../app", "").replace("/page.tsx", "")}`;
    expect(urls).toContain(bare);
    expect(urls).not.toContain(bare + "?locale=en");
    expect(urls).not.toContain(bare + "?locale=ru");
  }
  for (const path of ["privacy", "terms"]) {
    for (const locale of ["en", "ru"]) expect(urls).toContain(`https://www.24go.site/${path}?locale=${locale}`);
  }
  expect(new Set(urls).size).toBe(urls.length);
});
