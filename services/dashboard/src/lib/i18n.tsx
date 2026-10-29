"use client";
import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import en from "./public-en.json";
import ru from "./public-ru.json";

export type Lang = "en" | "ru";
type Translations = Record<string, string>;

const langs: Record<Lang, Translations> = { en, ru };

type TemplateParams = Record<string, string | number>;

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, fallback?: string | TemplateParams) => string;
}

function detectLocale(): Lang {
  if (typeof window === "undefined") return "en";

  // 1. URL ?locale= param (highest priority — explicit user choice)
  try {
    const params = new URLSearchParams(window.location.search);
    const urlLocale = params.get("locale");
    if (urlLocale === "ru" || urlLocale === "en") return urlLocale;
  } catch {}

  // 2. NEXT_LOCALE cookie (set by middleware)
  try {
    const match = document.cookie.match(/(?:^|;\s*)NEXT_LOCALE=(en|ru)/);
    if (match) return match[1] as Lang;
  } catch {}

  // 3. localStorage (remembered preference)
  try {
    const stored = localStorage.getItem("lang");
    if (stored === "ru" || stored === "en") return stored;
  } catch {}

  // 4. Accept-Language header (browser setting)
  try {
    const nav = navigator.language || (navigator as any).userLanguage || "";
    if (nav.toLowerCase().startsWith("ru")) return "ru";
  } catch {}

  return "en";
}

const Ctx = createContext<I18nCtx>({ lang: "en", setLang: () => {}, t: (k) => k });

export function I18nProvider({ children, initialLang }: { children: ReactNode; initialLang?: Lang }) {
  const [lang, setLangState] = useState<Lang>(() => initialLang ?? detectLocale());

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem("lang", l);
    // Also update cookie so server-rendered pages get correct lang
    document.cookie = `NEXT_LOCALE=${l}; path=/; max-age=31536000; samesite=lax`;
    // Update URL ?locale= param for crawlers
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("locale", l);
      window.history.replaceState({}, "", url.toString());
    } catch {}
  }, []);

  const t = useCallback((key: string, fallback?: string | TemplateParams): string => {
    const val = langs[lang]?.[key] || langs.en?.[key] || (typeof fallback === "string" ? fallback : undefined) || key;
    if (typeof fallback === "object" && fallback !== null) {
      return Object.entries(fallback).reduce(
        (s, [k, v]) => s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v)),
        val
      );
    }
    return val;
  }, [lang]);

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

// A route-owned message scope shares the root language state and AuthProvider.
// Both locales arrive in the route chunk, so switching never waits on a fetch.
export function MessageScope({ children, messages }: { children: ReactNode; messages: Record<Lang, Translations> }) {
  const { lang, setLang } = useContext(Ctx);
  const t = useCallback((key: string, fallback?: string | TemplateParams): string => {
    const value = messages[lang][key] || messages.en[key] || (typeof fallback === "string" ? fallback : undefined) || key;
    if (typeof fallback !== "object" || fallback === null) return value;
    return Object.entries(fallback).reduce((text, [name, replacement]) => text.split(`{${name}}`).join(String(replacement)), value);
  }, [lang, messages]);
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  return useContext(Ctx);
}
