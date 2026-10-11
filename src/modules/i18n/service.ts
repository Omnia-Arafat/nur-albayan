import { asc, eq } from "drizzle-orm";

import type { Db } from "@/db/client";
import { locales, uiMessages } from "@/db/schema";

export type Locale = typeof locales.$inferSelect;
export type Messages = Record<string, Record<string, string>>;

export async function getLocales(db: Db): Promise<Locale[]> {
  return db.select().from(locales).where(eq(locales.enabled, true)).orderBy(asc(locales.position));
}

/** The locale's UI strings by namespace, falling back key by key to the default locale. */
export async function getMessages(db: Db, locale: string): Promise<Messages> {
  const all = await getLocales(db);
  const fallback = all.find((l) => l.isDefault)?.code ?? all[0]?.code;
  const rows = await db.select().from(uiMessages);
  const out: Messages = {};
  for (const code of [fallback, locale]) {
    for (const r of rows.filter((x) => x.locale === code)) (out[r.namespace] ??= {})[r.key] = r.value;
  }
  return out;
}

/** "{name}" placeholders filled from vars. */
export const fill = (template: string, vars: Record<string, string | number> = {}) =>
  template.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
