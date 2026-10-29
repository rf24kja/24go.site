"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Platform, routePlatform, legacyPlatform, platformHref, platformHome } from "./platform-routes";
export type { Platform } from "./platform-routes";
export const PLATFORMS: Platform[] = ["telegram", "vkontakte", "whatsapp", "max", "facebook"];
export function isPlatform(p: string | null): p is Platform { return PLATFORMS.includes(p as Platform); }
interface PlatformContextType { platform: Platform; setPlatform: (p: Platform) => void; }
const PlatformContext = createContext<PlatformContextType>({ platform: "telegram", setPlatform: () => {} });
export function PlatformProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const selected = routePlatform(pathname);
  const [saved, setSaved] = useState<Platform | null>(null);
  useEffect(() => {
    const stored = localStorage.getItem("platform");
    setSaved(isPlatform(stored) ? stored : "telegram");
  }, []);
  const platform = selected ?? saved ?? "telegram";
  const legacy = !selected && saved ? legacyPlatform(pathname, saved) : null;
  useEffect(() => {
    if (selected) { localStorage.setItem("platform", selected); setSaved(selected); }
    else if (legacy) router.replace(platformHref(pathname + window.location.search + window.location.hash, legacy));
  }, [selected, legacy, pathname, router]);
  const setPlatform = (p: Platform) => { router.push(platformHome(p)); };
  // Resolve legacy URLs before child effects can issue platform-specific requests.
  if ((!selected && !saved) || legacy) return null;
  return <PlatformContext.Provider value={{ platform, setPlatform }}><div key={platform}>{children}</div></PlatformContext.Provider>;
}
export function usePlatform() { return useContext(PlatformContext); }
