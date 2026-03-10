"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import en from "./en.json";
import zh from "./zh.json";

type Locale = "en" | "zh";
type Translations = Record<string, string>;

const translations: Record<Locale, Translations> = { en, zh };

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue>({
  locale: "en",
  setLocale: () => {},
  t: (key: string) => key,
});

export function useI18n() {
  return useContext(I18nContext);
}

export function useT() {
  return useContext(I18nContext).t;
}

function detectLocale(): Locale {
  if (typeof window === "undefined") return "en";
  // Check localStorage first
  const saved = localStorage.getItem("muleteam-locale");
  if (saved === "en" || saved === "zh") return saved;
  // Detect from browser
  const lang = navigator.language || "";
  if (lang.startsWith("zh")) return "zh";
  return "en";
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    setLocaleState(detectLocale());
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem("muleteam-locale", newLocale);
  }, []);

  const t = useCallback(
    (key: string): string => {
      return translations[locale]?.[key] ?? translations.en[key] ?? key;
    },
    [locale]
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export const LOCALES: { value: Locale; label: string }[] = [
  { value: "en", label: "English" },
  { value: "zh", label: "中文" },
];
