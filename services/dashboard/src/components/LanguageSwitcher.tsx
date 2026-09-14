"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("locale") || "en";

  const switchLang = useCallback(
    (lang: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("locale", lang);
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  return (
    <div className={`flex items-center gap-1 bg-zinc-800/50 rounded-lg p-0.5 ${className}`}>
      <button
        onClick={() => switchLang("en")}
        className={`text-xs px-3 py-1.5 rounded font-medium transition ${
          current === "en"
            ? "bg-zinc-700 text-zinc-100"
            : "text-zinc-500 hover:text-zinc-300"
        }`}
      >
        EN
      </button>
      <button
        onClick={() => switchLang("ru")}
        className={`text-xs px-3 py-1.5 rounded font-medium transition ${
          current === "ru"
            ? "bg-zinc-700 text-zinc-100"
            : "text-zinc-500 hover:text-zinc-300"
        }`}
      >
        RU
      </button>
    </div>
  );
}
