"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

// ponytail: services with dedicated tabs. billing stays shared across all.
export type Platform = "telegram" | "vkontakte" | "whatsapp" | "max" | "facebook";

export const PLATFORMS: Platform[] = ["telegram", "vkontakte", "whatsapp", "max", "facebook"];

export function isPlatform(p: string | null): p is Platform {
  return (PLATFORMS as string[]).includes(p ?? "");
}

interface PlatformContextType {
  platform: Platform;
  setPlatform: (p: Platform) => void;
}

const PlatformContext = createContext<PlatformContextType>({
  platform: "telegram",
  setPlatform: () => {},
});

export function PlatformProvider({ children }: { children: ReactNode }) {
  const [platform, setPlatformState] = useState<Platform>("telegram");

  useEffect(() => {
    const saved = localStorage.getItem("platform");
    if (isPlatform(saved)) {
      setPlatformState(saved);
    }
  }, []);

  const setPlatform = (p: Platform) => {
    setPlatformState(p);
    localStorage.setItem("platform", p);
  };

  return (
    <PlatformContext.Provider value={{ platform, setPlatform }}>
      {children}
    </PlatformContext.Provider>
  );
}

export function usePlatform() {
  return useContext(PlatformContext);
}
