import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
it("llms document exposes absolute Markdown links to public documentation, not private API/admin routes", () => {
 const text = readFileSync(resolve(process.cwd(), "public/llms.txt"), "utf8");
 expect(text).toMatch(/^# .+/m);
 const links = Array.from(text.matchAll(/\[[^\]]+\]\((https:\/\/[^\s)]+)\)/g), m => m[1]);
 expect(links.length).toBeGreaterThan(0);
 for (const href of links) {
  const url = new URL(href);
  expect(url.origin).toBe("https://www.24go.site");
  expect(url.pathname).not.toMatch(/^(?:\/admin|\/api|\/contacts|\/dashboard)/);
 }
});
