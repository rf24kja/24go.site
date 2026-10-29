import { afterEach, expect, it, vi } from "vitest";
import { api, ApiError } from "@/lib/api";

afterEach(() => vi.unstubAllGlobals());
it.each([204, 205])("accepts successful empty HTTP %s without parsing JSON", async (status) => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status })));
  await expect(api("/api/v1/groups/example", { method: "DELETE" })).resolves.toBeUndefined();
});
it("keeps normal JSON and HTTP errors intact", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response('{"items":[]}'))
    .mockResolvedValueOnce(new Response('{"detail":"denied"}', { status: 403 }));
  vi.stubGlobal("fetch", fetcher);
  await expect(api("/api/v1/groups")).resolves.toEqual({ items: [] });
  await expect(api("/api/v1/groups")).rejects.toMatchObject({ status: 403, message: "denied" });
});
it("does not hide malformed JSON from successful data endpoints", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("not json")));
  await expect(api("/api/v1/groups")).rejects.toBeInstanceOf(SyntaxError);
});
