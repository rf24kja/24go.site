import { afterEach, expect, it, vi } from "vitest";
import { exportLeadsCsv } from "@/lib/api";
afterEach(() => vi.unstubAllGlobals());
it("exports the requested status using the backend status_filter contract", async () => {
  const fetcher = vi.fn(async (_url: RequestInfo | URL) => new Response("csv"));
  vi.stubGlobal("fetch", fetcher);
  await exportLeadsCsv("synthetic", { status: "converted", platform: "vkontakte", intent_score: "HOT" });
  const url = new URL(String(fetcher.mock.calls[0][0]));
  expect(url.searchParams.get("status_filter")).toBe("converted");
  expect(url.searchParams.has("status")).toBe(false);
  expect(url.searchParams.get("platform")).toBe("vkontakte");
  expect(url.searchParams.get("intent_score")).toBe("HOT");
});
it("omits absent filters rather than serializing undefined", async () => {
  const fetcher = vi.fn(async (_url: RequestInfo | URL) => new Response("csv"));
  vi.stubGlobal("fetch", fetcher);
  await exportLeadsCsv("synthetic", { status: undefined, platform: "telegram" });
  const url = new URL(String(fetcher.mock.calls[0][0]));
  expect(url.searchParams.has("status_filter")).toBe(false);
  expect(url.searchParams.has("status")).toBe(false);
  expect(url.searchParams.get("platform")).toBe("telegram");
});
