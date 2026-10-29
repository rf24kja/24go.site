import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("@/components/LanguageSwitcher", () => ({ LanguageSwitcher: () => null }));

const pages = import.meta.glob("../app/{features,pricing,tools,integrations,tutorials,privacy,terms}/**/page.tsx");
const bilingual = Object.entries(pages).filter(([name]) => !/\/tools\/[^/]+\/page/.test(name));
for (const [name, load] of bilingual) {
  const path = name.replace("../app", "").replace("/page.tsx", "");
  it.each(["en", "ru"])(`${path} declares its own localized canonical and reciprocal languages (%s)`, async locale => {
    const page: any = await load();
    const metadata = page.generateMetadata ? await page.generateMetadata({ searchParams: { locale } }) : page.metadata;
    const en = `https://www.24go.site${path}?locale=en`;
    const ru = `https://www.24go.site${path}?locale=ru`;
    expect(metadata.alternates).toEqual({ canonical: locale === "ru" ? ru : en, languages: { en, ru, "x-default": en } });
  });
  it(`${path} already has distinct EN/RU body content (no translations introduced)`, async () => {
    const page: any = await load();
    const bodies = [];
    for (const locale of ["en", "ru"]) {
      const html = renderToStaticMarkup(await page.default({ searchParams: { locale } }));
      const doc = new DOMParser().parseFromString(html, "text/html");
      doc.querySelectorAll("header, script").forEach(node => node.remove());
      bodies.push(doc.body.textContent || "");
    }
    expect(bodies[0]).not.toBe(bodies[1]);
    expect(bodies[1]).toMatch(/[А-Яа-я]/);
  });
}
