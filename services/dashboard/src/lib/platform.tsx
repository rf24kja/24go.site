"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Platform = "telegram" | "vkontakte";

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
    const saved = localStorage.getItem("platform") as Platform | null;
    if (saved === "telegram" || saved === "vkontakte") {
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
