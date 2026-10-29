import { expect, it } from "vitest";
import { platformHref, platformDestination, PREFIXES, Platform } from "@/lib/platform-routes";
it("keeps only Billing unprefixed and gives every existing utility submenu a platform URL", () => {
 for (const platform of Object.keys(PREFIXES) as Platform[]) {
  expect(platformHref('/billing',platform)).toBe('/billing');
  expect(platformHref('/settings',platform)).toBe('/'+PREFIXES[platform]+'/settings');
  expect(platformDestination('/'+PREFIXES[platform]+'/settings')).toBe('/settings');
 }
 for (const platform of ['telegram','vkontakte'] as Platform[]) for(const page of ['users','audit','admin','health','blog-admin']) {
  expect(platformHref('/'+page,platform)).toBe('/'+PREFIXES[platform]+'/'+page);
  expect(platformDestination('/'+PREFIXES[platform]+'/'+page)).toBe('/'+page);
 }
});
