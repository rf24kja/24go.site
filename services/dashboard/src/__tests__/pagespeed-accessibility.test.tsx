import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
vi.mock("@/lib/i18n", () => ({ useI18n: () => ({ t: (key: string) => key, lang: "en", setLang: vi.fn() }) }));
vi.mock("@/components/motion/AnimatedSection", () => ({ AnimatedSection: ({children}: any) => <div>{children}</div> }));
vi.mock("@/components/motion/MotionCard", () => ({ MotionCard: ({children}: any) => <div>{children}</div> }));
vi.mock("@/components/magicui", async () => ({ TextAnimate: (await import("@/components/magicui/text-animate")).TextAnimate }));
import LandingPage from "@/components/LandingPage";
import { TextAnimate } from "@/components/magicui/text-animate";

it("landing has one main landmark containing the hero and platform guides, not navigation/footer", () => {
 const doc = new DOMParser().parseFromString(renderToStaticMarkup(<LandingPage/>), "text/html");
 expect(doc.querySelectorAll("main")).toHaveLength(1);
 const main = doc.querySelector("main")!;
 expect(main.querySelector("h1")?.textContent).toContain("landing.heroTitle1");
 expect(main.querySelector("#platforms")).not.toBeNull();
 expect(main.contains(doc.querySelector("nav"))).toBe(false);
 expect(main.querySelector("footer")).toBeNull();
});
it("animated headings retain complete readable text before hydration", () => {
 const text = "Как работает 24GO";
 const doc = new DOMParser().parseFromString(renderToStaticMarkup(<TextAnimate as="h2" text={text}/>), "text/html");
 expect(doc.querySelector("h2")?.textContent?.replace(/\u00a0/g, " ")).toBe(text);
});
