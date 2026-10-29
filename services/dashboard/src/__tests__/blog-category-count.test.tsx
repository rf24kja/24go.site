import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import BlogContent from "@/components/BlogList";

const posts = [
  { id: "1", slug: "telegram", title: "Telegram", excerpt: "Example", tags: ["telegram"], created_at: "2026-10-20T00:00:00Z" },
  { id: "2", slug: "note", title: "Note", excerpt: "Example", tags: [], created_at: "2026-10-20T00:00:00Z" },
];

describe("archive category totals", () => {
  it.each([["en", "All"], ["ru", "Все"]])("counts unclassified posts only once in the %s total", (locale, label) => {
    const html = renderToStaticMarkup(<BlogContent initialPosts={posts} initialLocale={locale} archivePage={1} />);
    const doc = new DOMParser().parseFromString(html, "text/html");
    const all = [...doc.querySelectorAll("button")].find(button => button.textContent?.includes(label));
    expect(all?.textContent?.replace(/\s/g, "")).toBe(`📚${label}2`);
  });
});
