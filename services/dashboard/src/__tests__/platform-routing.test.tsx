import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { platformHref, routePlatform, PLATFORM_PAGES, PREFIXES, Platform } from "@/lib/platform-routes";
const nav = vi.hoisted(() => ({ path: "/VK/targets", push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.path, useRouter: () => nav }));
import { PlatformProvider, usePlatform } from "@/lib/platform";
afterEach(cleanup);
beforeEach(() => { localStorage.clear(); nav.push.mockClear(); nav.replace.mockClear(); });
const calls: string[] = [];
function Child() { const { platform, setPlatform } = usePlatform(); useEffect(() => { calls.push(platform); }, [platform]); return <button onClick={() => setPlatform("facebook")}>{platform}</button>; }
describe("bounded platform URLs", () => {
  it("accepts every displayed page only for its platform", () => {
    for (const p of Object.keys(PREFIXES) as Platform[]) for (const page of PLATFORM_PAGES[p]) expect(routePlatform(`/${PREFIXES[p]}/${page}`)).toBe(p);
    for (const path of ["/VK/wa-groups", "/TG/fb-connect", "/MAX/targets", "/FB/mailings", "/WA/targets", "/tg/groups", "/VK/groups/anything", "/VK//groups"]) expect(routePlatform(path)).toBeNull();
  });
  it("preserves query/hash and shared pages", () => {
    expect(platformHref("/targets?locale=ru#search", "vkontakte")).toBe("/VK/targets?locale=ru#search");
    expect(platformHref('/billing',"facebook")).toBe('/billing');
    expect(platformHref('/settings',"facebook")).toBe('/FB/settings');
    expect(platformHref("https://example.com/targets", "telegram")).toBe("https://example.com/targets");
    expect(platformHref("/leads/00000000-0000-0000-0000-000000000001", "max")).toBe("/MAX/leads/00000000-0000-0000-0000-000000000001");
  });
  it("URL overrides stale storage before the first child effect and on back navigation", async () => {
    localStorage.setItem("platform", "telegram"); calls.length = 0; nav.path = "/VK/targets";
    const view = render(<PlatformProvider><Child /></PlatformProvider>);
    expect(calls).toEqual(["vkontakte"]);
    nav.path = "/FB/groups"; view.rerender(<PlatformProvider><Child /></PlatformProvider>);
    expect(screen.getByRole("button").textContent).toBe("facebook");
    nav.path = "/VK/targets"; view.rerender(<PlatformProvider><Child /></PlatformProvider>);
    expect(calls).toEqual(["vkontakte", "facebook", "vkontakte"]);
  });
  it("legacy pages redirect without mounting a wrong-platform child", async () => {
    nav.path = "/targets"; localStorage.setItem("platform","vkontakte"); calls.length = 0;
    render(<PlatformProvider><Child /></PlatformProvider>);
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/VK/targets'));
    expect(calls).toEqual([]);
  });
});
