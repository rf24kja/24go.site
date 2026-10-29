import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import RootLayout, { metadata } from "@/app/layout";
vi.mock("next/headers", () => ({ headers: () => new Headers({ "x-locale": "ru" }), cookies: () => ({ get: () => undefined }) }));
vi.mock("@/app/providers", () => ({ Providers: ({ children }: any) => children }));
vi.mock("@/components/Toast", () => ({ ToastProvider: ({ children }: any) => children }));
vi.mock("@/components/motion/SmoothScrollProvider", () => ({ SmoothScrollProvider: ({ children }: any) => children }));
vi.mock("@/components/CookieConsent", () => ({ default: () => null }));
it("renders no global homepage hreflang or canonical, leaving page metadata as sole owner", () => {
  const html = renderToStaticMarkup(<RootLayout><article>Article</article></RootLayout>);
  const doc = new DOMParser().parseFromString(html, "text/html");
  expect(doc.documentElement.lang).toBe("ru");
  expect(doc.querySelectorAll("link[hreflang],link[rel=canonical]").length).toBe(0);
  expect(doc.querySelector('link[type="application/rss+xml"]')).not.toBeNull();
  expect(metadata.alternates).toBeUndefined();
});
