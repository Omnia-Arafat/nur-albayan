import "../globals.css";

import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AppDataProvider } from "@/components/app/app-data";
import { DeviceSettings } from "@/components/app/device-settings";
import { getDb } from "@/db/client";
import { feedbackMessages } from "@/db/schema";
import { getCatalog } from "@/modules/catalog/service";
import { listLessons } from "@/modules/content/service";
import { getLocales, getMessages } from "@/modules/i18n/service";
import { getTheme } from "@/modules/theme/service";

async function load(code: string) {
  const db = await getDb();
  const locales = await getLocales(db);
  const locale = locales.find((l) => l.code === code);
  if (!locale) notFound();
  const [messages, catalog, lessons, theme, feedback] = await Promise.all([
    getMessages(db, code),
    getCatalog(db, code),
    listLessons(db, code),
    getTheme(db),
    db.select().from(feedbackMessages).where(eq(feedbackMessages.locale, code)),
  ]);
  return { locale, locales, messages, catalog, lessons, theme, feedback };
}

export async function generateMetadata(props: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { messages } = await load((await props.params).locale);
  return { title: messages.app?.["brand.name"], description: messages.app?.["brand.tagline"] };
}

export default async function LocaleLayout(props: LayoutProps<"/[locale]">) {
  const { locale, locales, messages, catalog, lessons, theme, feedback } = await load((await props.params).locale);
  return (
    <html lang={locale.code} dir={locale.dir} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {theme.fontUrls.map((u) => (
          <link key={u} rel="stylesheet" href={u} />
        ))}
        <style id="nb-theme" dangerouslySetInnerHTML={{ __html: theme.css }} />
      </head>
      <body>
        <AppDataProvider
          value={{
            locale,
            locales,
            messages,
            catalog,
            lessons,
            feedback: feedback.map(({ kind, text, weight }) => ({ kind, text, weight })),
          }}
        >
          <div className="nb-app">
            <DeviceSettings />
            {props.children}
          </div>
        </AppDataProvider>
      </body>
    </html>
  );
}
