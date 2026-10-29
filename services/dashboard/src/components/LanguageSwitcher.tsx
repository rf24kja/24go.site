"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { useI18n } from "@/lib/i18n";

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { setLang } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("locale") || "en";

  const switchLang = useCallback(
    (lang: "en" | "ru") => {
      setLang(lang);
      const params = new URLSearchParams(searchParams.toString());
      params.set("locale", lang);
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams, setLang]
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
