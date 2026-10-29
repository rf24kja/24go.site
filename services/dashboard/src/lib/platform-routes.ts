export type Platform = "telegram" | "vkontakte" | "whatsapp" | "max" | "facebook";
export const PREFIXES: Record<Platform, string> = { telegram: "TG", vkontakte: "VK", whatsapp: "WA", facebook: "FB", max: "MAX" };
const PAGE_ALIASES: Partial<Record<Platform, Record<string, string>>> = {
  vkontakte: { "vk-overview": "analytics", "vk-help": "help", "vk-settings": "integrations" },
  whatsapp: { "wa-overview": "analytics", "wa-accounts": "accounts", "wa-groups": "groups" },
  facebook: { "fb-marketplace": "marketplace", "fb-connect": "accounts" },
  max: { "max-accounts": "accounts" },
};
function sourcePage(platform: Platform, page: string): string {
  return Object.entries(PAGE_ALIASES[platform] ?? {}).find(([, alias]) => alias === page)?.[0] ?? page;
}
export function platformDestination(path: string): string {
  const platform = routePlatform(path);
  if (!platform) return path;
  const [, , page, ...rest] = path.split("/");
  return "/" + [sourcePage(platform, page), ...rest].join("/");
}
export const PLATFORM_PAGES: Record<Platform, readonly string[]> = {
  telegram: ["analytics", "leads", "lead-rules", "targets", "groups", "accounts", "proxies", "campaigns", "mailings", "onboarding", "help", "settings", "users", "audit", "admin", "health", "blog-admin", "auto-replies", "scoring", "contacts"],
  vkontakte: ["vk-overview", "leads", "lead-rules", "targets", "groups", "accounts", "proxies", "campaigns", "mailings", "onboarding", "vk-help", "vk-settings", "settings", "users", "audit", "admin", "health", "blog-admin", "auto-replies", "scoring", "contacts"],
  whatsapp: ["wa-overview", "help", "leads", "wa-accounts", "wa-groups", "contacts", "campaigns", "mailings", "settings"],
  facebook: ["groups", "help", "leads", "contacts", "fb-marketplace", "fb-connect", "settings"],
  max: ["max-accounts", "help", "leads", "settings"],
};
export function routePlatform(path: string): Platform | null {
  const [, prefix, page, ...rest] = path.split("/");
  const platform = (Object.keys(PREFIXES) as Platform[]).find(p => PREFIXES[p] === prefix);
  const detail = page === "leads" && rest.length === 1 && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rest[0]);
  return platform && (!rest.length || detail) && PLATFORM_PAGES[platform].includes(sourcePage(platform, page)) ? platform : null;
}
export function platformHref(href: string, platform: Platform): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  const boundary = href.search(/[?#]/);
  const path = boundary < 0 ? href : href.slice(0, boundary);
  const suffix = boundary < 0 ? "" : href.slice(boundary);
  if (routePlatform(path)) return href;
  const [page, ...rest] = path.slice(1).split("/");
  const canonical = "/" + [PAGE_ALIASES[platform]?.[page] ?? page, ...rest].join("/");
  return routePlatform(`/${PREFIXES[platform]}${canonical}`) ? `/${PREFIXES[platform]}${canonical}${suffix}` : href;
}
export function platformHome(platform: Platform): string {
  return platformHref("/" + PLATFORM_PAGES[platform][0], platform);
}
export function legacyPlatform(path: string, saved: Platform): Platform | null {
  if (routePlatform(`/${PREFIXES[saved]}${path}`)) return saved;
  return (Object.keys(PREFIXES) as Platform[]).find(p => routePlatform(`/${PREFIXES[p]}${path}`)) ?? null;
}
