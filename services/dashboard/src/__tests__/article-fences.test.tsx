import React from "react";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import Page from "@/app/blog/[slug]/page";
// Legacy static renderer does not execute async RSC children; the exact build covers streaming.
vi.mock("@/components/RelatedArticles", () => ({ RelatedArticles: () => null }));

const anchors = ["auto-reply", "database", "dashboard", "scheduling", "monitoring", "deployment", "advanced", "troubleshooting"];
afterEach(() => vi.unstubAllGlobals());
async function render(post: any, locale: string) {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(JSON.stringify(String(url).includes(post.slug) ? post : []))));
  const html = renderToStaticMarkup(await Page({ params: { slug: post.slug }, searchParams: { locale } }));
  const doc = document.createElement("div");
  doc.innerHTML = html;
  return doc;
}
it.each(["en", "ru"])("preserves all eight existing article anchors after Python backtick strings (%s)", async locale => {
  const post = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "fixtures", `fragment-public-${locale}.json`), "utf8"));
  const doc = await render(post, locale);
  for (const name of anchors) expect(doc.querySelector(`a[name="${name}"]`), name).not.toBeNull();
  expect([...doc.querySelectorAll("pre code")].some(code => code.textContent?.includes('re.sub(r"```"'))).toBe(true);
});
it("keeps fenced HTML and markdown opaque and honors longer closing fences", async () => {
  const code = 'value = "```"\n```\n<script>window.fenceExecuted = true</script>\n<img src=x onerror="window.fenceExecuted = true">\n**literal** &lt;literal&gt;\n[link](https://example.com)\n';
  const doc = await render({ slug: "fences", title: "Fences", created_at: "2026-01-01", content: '````python\n' + code + '````\n\n<a name="existing"></a>\n' }, "en");
  expect(doc.querySelector("pre code")?.textContent).toBe(code);
  expect(doc.querySelector("pre script, pre img, pre a, pre strong, pre em")).toBeNull();
  expect(doc.querySelector('a[name="existing"]')).not.toBeNull();
});
