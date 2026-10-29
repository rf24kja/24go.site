import React from "react";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PlatformOverview } from "@/components/PlatformOverview";
vi.mock("@/lib/i18n", () => ({ useI18n: () => ({ t: (k: string) => k, lang: "en", setLang: vi.fn() }) }));
vi.mock("@/components/motion/AnimatedSection", () => ({ AnimatedSection: ({children}: any) => <div>{children}</div> }));
vi.mock("@/components/motion/MotionCard", () => ({ MotionCard: ({children}: any) => <div>{children}</div> }));
vi.mock("@/components/magicui", () => ({ TextAnimate: ({text}: any) => <span>{text}</span> }));
import LandingPage from "@/components/LandingPage";
afterEach(() => { cleanup(); document.body.style.overflow = ""; });
it.each(["en", "ru"])("renders all platform workflows and real anchors in %s", lang => {
 const {container} = render(<PlatformOverview lang={lang}/>);
 for (const id of ["telegram","facebook","vkontakte","max","whatsapp"]) {
  expect(container.querySelector(`#platform-${id}`)).not.toBeNull();
  expect(container.querySelector(`a[href="#platform-${id}"]`)).not.toBeNull();
 }
 expect(container.textContent).toContain(lang === "ru" ? "Пять платформ" : "Five platforms");
});
it("reviews have two close controls, Escape and restore page scroll and focus", () => {
 render(<LandingPage/>);
 const opener = screen.getByRole("button", {name: "landing.viewAllReviews"});
 opener.focus(); fireEvent.click(opener);
 const dialog = screen.getByRole("dialog");
 expect(within(dialog).getAllByRole("button", {name: "landing.closeReviews"})).toHaveLength(2);
 expect(dialog).toHaveAttribute("data-lenis-prevent");
 expect(document.body.style.overflow).toBe("hidden");
 fireEvent.keyDown(document, {key: "Escape"});
 expect(screen.queryByRole("dialog")).toBeNull();
 expect(document.body.style.overflow).toBe("");
 expect(document.activeElement).toBe(opener);
 fireEvent.click(opener);
 fireEvent.click(within(screen.getByRole("dialog")).getAllByRole("button")[1]);
 expect(screen.queryByRole("dialog")).toBeNull();
 expect(document.body.style.overflow).toBe("");
});
it("hero platform button and how navigation point to their named sections", () => {
 render(<LandingPage/>);
 expect(screen.getByRole("link", {name: "Explore platforms"})).toHaveAttribute("href", "#platforms");
 expect(document.getElementById("platforms")).not.toBeNull();
 for (const link of screen.getAllByRole("link", {name: "landing.navHow"})) expect(link).toHaveAttribute("href", "#how");
 expect(document.getElementById("how")?.textContent).toContain("How 24GO works");
 expect(document.getElementById("workflow")?.textContent).toContain("Telegram and VK");
});
it.each(["en", "ru"])("each platform has specific requirements, results and limitations in %s", lang => {
 render(<PlatformOverview lang={lang}/>);
 const articles = screen.getAllByRole("article");
 expect(articles).toHaveLength(5);
 for (const article of articles) {
  expect(within(article).getByText(lang === "ru" ? "Что нужно подключить" : "What you need")).toBeTruthy();
  expect(within(article).getByText(lang === "ru" ? "Важно учитывать" : "Keep in mind")).toBeTruthy();
  expect(within(article).getAllByRole("listitem")).toHaveLength(6);
 }
});
