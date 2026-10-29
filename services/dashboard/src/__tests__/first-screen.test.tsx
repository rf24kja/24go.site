import React from "react";
import { render, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("@/lib/i18n", () => ({ useI18n: () => ({ t: (k: string) => k, lang: "en", setLang: vi.fn() }) }));
vi.mock("@/components/motion/MotionCard", () => ({ MotionCard: ({children}: any) => <div>{children}</div> }));
vi.mock("@/components/magicui", () => ({ TextAnimate: ({text}: any) => <span>{text}</span> }));
vi.mock("gsap", () => ({ default: { registerPlugin: vi.fn(), context: (fn: any) => { fn(); return {revert: vi.fn()}; }, from: (elements: HTMLElement[]) => elements.forEach(el => {el.style.opacity = "0";}) } }));
vi.mock("gsap/ScrollTrigger", () => ({ ScrollTrigger: {} }));
import LandingPage from "@/components/LandingPage";
afterEach(cleanup);
it("hydrated hero heading description and CTA never enter a hidden animation ancestor", () => {
 vi.stubGlobal("matchMedia", () => ({matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn()}));
 const {container} = render(<LandingPage/>);
 for (const el of [container.querySelector("h1"), container.querySelector("h1 + p"), container.querySelector('main a[href="/login"]')]) {
  expect(el).not.toBeNull();
  let current = el as HTMLElement | null;
  while(current) { expect(current.style.opacity).not.toBe("0"); current = current.parentElement; }
 }
});
