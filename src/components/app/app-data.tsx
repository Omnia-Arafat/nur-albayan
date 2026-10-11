"use client";

import { createContext, useContext, useMemo } from "react";

import type { Catalog } from "@/modules/catalog/service";
import type { LessonListItem } from "@/modules/content/service";
import { fill, type Locale, type Messages } from "@/modules/i18n/service";

export type AppData = {
  locale: Locale;
  locales: Locale[];
  messages: Messages;
  catalog: Catalog;
  lessons: LessonListItem[];
  feedback: { kind: string; text: string; weight: number }[];
};

const Ctx = createContext<AppData | null>(null);

export function AppDataProvider({ value, children }: { value: AppData; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside AppDataProvider");
  return v;
}

/** t("nav.games"), t("lesson.cardOf", { n, total }); numbers are written in the locale's digits. */
export function useT() {
  const { messages, locale } = useApp();
  return useMemo(() => {
    const nf = new Intl.NumberFormat(`${locale.code}-u-nu-${locale.numberingSystem}`);
    const num = (n: number) => nf.format(n);
    const pf = new Intl.NumberFormat(`${locale.code}-u-nu-${locale.numberingSystem}`, { style: "percent" });
    const pct = (x: number) => pf.format(x);
    const t = (key: string, vars: Record<string, string | number> = {}) => {
      const v = Object.fromEntries(Object.entries(vars).map(([k, x]) => [k, typeof x === "number" ? num(x) : x]));
      return fill(messages.app?.[key] ?? key, v);
    };
    return Object.assign(t, { num, pct, href: (path: string) => `/${locale.code}${path}` });
  }, [messages, locale]);
}

/** XP per finished page and per star, from the gamification settings. */
export const xpRates = (catalog: Catalog) => ({
  perLesson: Number(catalog.settings["gamification.xpPerLesson"] ?? 0),
  perStar: Number(catalog.settings["gamification.xpPerStar"] ?? 0),
});
