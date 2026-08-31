"use client";
import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import en from "./en.json";
import ru from "./ru.json";

type Lang = "en" | "ru";
type Translations = Record<string, string>;

const langs: Record<Lang, Translations> = { en, ru };

type TemplateParams = Record<string, string | number>;

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, fallback?: string | TemplateParams) => string;
}

const Ctx = createContext<I18nCtx>({ lang: "en", setLang: () => {}, t: (k) => k });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("lang") as Lang) || "en";
    }
    return "en";
  });

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem("lang", l);
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

export function useI18n() {
  return useContext(Ctx);
}
