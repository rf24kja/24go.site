import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ lang: "en", toast: vi.fn(), calls: [] as {url: string; body: any}[] }));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ auth: { token: "synthetic" } }) }));
vi.mock("@/lib/platform", () => ({ usePlatform: () => ({ platform: "telegram" }) }));
vi.mock("@/lib/i18n", () => ({ useI18n: () => ({ t: (k: string) => k, lang: state.lang }) }));
vi.mock("@/components/Toast", () => ({ useToast: () => ({ toast: state.toast }) }));
import TargetsPage from "@/app/(dashboard)/targets/page";
beforeEach(() => {
 state.calls = []; state.lang = "en";
 vi.stubGlobal("fetch", vi.fn(async (url, opts) => {
  const body = opts?.body ? JSON.parse(opts.body) : null; state.calls.push({url: String(url), body});
  return new Response(JSON.stringify(String(url).includes("group-search") ? {results: [], total: 0, cost_kopeks: 100, cache_hit: false, query_type: "tgstat", query: body.query} : {items: []}), {status: 200});
 }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it("requires paid confirmation before TgStat and explicitly opts in without changing free discovery", async () => {
 const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
 render(<TargetsPage />);
 fireEvent.click(screen.getByText("targets.scan"));
 await waitFor(() => expect(state.calls.some(c => c.url.includes("groups/discover"))).toBe(true));
 expect(state.calls.find(c => c.url.includes("groups/discover"))?.body.use_tgstat).toBeUndefined();
 fireEvent.click(screen.getByText("TgStat"));
 fireEvent.change(screen.getByPlaceholderText("недвижимость Москва"), {target: {value: "travel"}});
 fireEvent.click(screen.getByText("targets.find"));
 expect(confirm).toHaveBeenCalledWith(expect.stringMatching(/paid.*TgStat|TgStat.*paid/i));
 expect(state.calls.filter(c => c.url.includes("group-search"))).toHaveLength(0);
 confirm.mockReturnValue(true);
 fireEvent.click(screen.getByText("targets.find"));
 await waitFor(() => expect(state.calls.find(c => c.url.includes("group-search"))?.body.use_tgstat).toBe(true));
});
