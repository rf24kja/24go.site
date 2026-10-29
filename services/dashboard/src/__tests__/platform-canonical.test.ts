import { expect, it } from "vitest";
import { platformHref, platformDestination, routePlatform } from "@/lib/platform-routes";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
it("uses consistent canonical platform page names with legacy compatibility", () => {
  for (const [platform, old, canonical] of [
    ["whatsapp", "/wa-groups", "/WA/groups"],
    ["whatsapp", "/wa-accounts", "/WA/accounts"],
    ["vkontakte", "/vk-overview", "/VK/analytics"],
    ["facebook", "/fb-connect", "/FB/accounts"],
    ["max", "/max-accounts", "/MAX/accounts"],
  ] as const) {
    expect(platformHref(old, platform)).toBe(canonical);
    expect(routePlatform(canonical)).toBe(platform);
    expect(platformDestination(canonical)).toBe(old);
    expect(middleware(new NextRequest("https://24go.site" + canonical)).headers.get("x-middleware-rewrite")).toBe("https://24go.site" + old);
  }
});
