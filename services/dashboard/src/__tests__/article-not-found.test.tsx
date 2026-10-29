import { afterEach, expect, it, vi } from "vitest";
import Page, { generateMetadata } from "@/app/blog/[slug]/page";
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));
afterEach(() => vi.unstubAllGlobals());
const props = { params: { slug: "missing" }, searchParams: { locale: "en" } };
it.each([Page, generateMetadata])("returns Next notFound for an API 404 (%#)", async handler => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ detail: "Missing" }), { status: 404 })));
  await expect(handler(props)).rejects.toThrow("NEXT_NOT_FOUND");
});
it.each([Page, generateMetadata])("propagates upstream 503 instead of a 404 (%#)", async handler => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ detail: "Unavailable" }), { status: 503 })));
  await expect(handler(props)).rejects.toMatchObject({ status: 503 });
});
