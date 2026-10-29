import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider, useI18n } from "@/lib/i18n";
import en from "@/lib/en.json";
import ru from "@/lib/ru.json";

const request = vi.hoisted(() => ({ locale: "en" }));
vi.mock("next/headers", () => ({ headers: () => new Headers({ "x-locale": request.locale }) }));
vi.mock("@/components/LandingPage", () => ({ default: () => null }));
vi.mock("@/components/motion/SmoothScrollProvider", () => ({ SmoothScrollProvider: ({ children }: { children: React.ReactNode }) => children }));
import { generateMetadata } from "@/app/page";

function Probe() {
  const { lang, t } = useI18n();
  return <output data-lang={lang}>{t("landing.heroTitle1")}</output>;
}

describe("homepage server locale", () => {
  it("renders the server-selected dictionary before browser effects", () => {
    for (const [lang, dictionary] of [["en", en], ["ru", ru]] as const) {
      const html = renderToStaticMarkup(<I18nProvider initialLang={lang}><Probe /></I18nProvider>);
      expect(html).toContain(`data-lang="${lang}"`);
      expect(html).toContain(dictionary["landing.heroTitle1"]);
    }
  });

  it("uses English metadata for an explicit English URL even with a Russian request locale", async () => {
    request.locale = "ru";
    const metadata = await generateMetadata({ searchParams: { locale: "en" } });
    expect(metadata.description).toEqual(expect.any(String));
    expect(String(metadata.description)).not.toMatch(/[А-Яа-яЁё]/);
    expect(metadata.openGraph?.description).toBe(metadata.description);
    expect(metadata.twitter?.description).toBe(metadata.description);
    expect(metadata.alternates?.canonical).toBe("https://www.24go.site?locale=en");
  });

  it("uses Russian metadata for an explicit Russian URL", async () => {
    request.locale = "en";
    const metadata = await generateMetadata({ searchParams: { locale: "ru" } });
    expect(String(metadata.description)).toMatch(/[А-Яа-яЁё]/);
    expect(metadata.openGraph?.description).toBe(metadata.description);
    expect(metadata.twitter?.description).toBe(metadata.description);
    expect(metadata.alternates?.canonical).toBe("https://www.24go.site?locale=ru");
  });

  it("keeps metadata aligned with middleware locale when the URL has no explicit locale", async () => {
    request.locale = "ru";
    const metadata = await generateMetadata({ searchParams: {} });
    expect(String(metadata.description)).toMatch(/[А-Яа-яЁё]/);
    expect(metadata.alternates?.canonical).toBe("https://www.24go.site?locale=ru");
  });
});
