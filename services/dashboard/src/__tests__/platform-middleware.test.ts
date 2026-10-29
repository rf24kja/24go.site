import { expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
it("rewrites only supported platform-page pairs and preserves query and locale", () => {
 const response = middleware(new NextRequest("https://24go.site/VK/targets?locale=ru"));
 expect(response.headers.get("x-middleware-rewrite")).toBe("https://24go.site/targets?locale=ru");
 expect(response.headers.get("x-middleware-request-x-locale")).toBe("ru");
 expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
 for (const path of ["/FB/mailings","/WA/targets","/MAX/groups","/TG/unknown","/VK/groups/arbitrary","/billing","/settings"]) {
   expect(middleware(new NextRequest('https://24go.site'+path)).headers.get("x-middleware-rewrite")).toBeNull();
 }
});
