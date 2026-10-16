import "../globals.css";

import { eq } from "drizzle-orm";
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";

import { AppDataProvider } from "@/components/app/app-data";
import { DeviceSettings } from "@/components/app/device-settings";
import { OfflineSupport } from "@/components/app/offline";
import { FitText } from "@/components/book/fit-text";
import { DEVICE_KEY } from "@/modules/progress/keys";
import { getDb } from "@/db/client";
import { feedbackMessages } from "@/db/schema";
import { getCatalog } from "@/modules/catalog/service";
import { listLessons } from "@/modules/content/service";
import { getLocales, getMessages } from "@/modules/i18n/service";
import { getTheme, tokenValues } from "@/modules/theme/service";

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
  return {
    title: messages.app?.["brand.name"],
    description: messages.app?.["brand.tagline"],
    icons: { apple: "/app-icon/apple-180.png" },
    appleWebApp: { capable: true, title: messages.app?.["brand.name"] },
  };
}

/** The browser bar takes the book's paper colour. */
export async function generateViewport(): Promise<Viewport> {
  const tokens = await tokenValues(await getDb());
  return { themeColor: tokens.get("color.paper") };
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
        {/* Picks day or night before the first paint, so a night reader never sees a white flash. */}
        <script dangerouslySetInnerHTML={{ __html: themeBoot(catalog.settings["display.themeMode"]) }} />
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
            <OfflineSupport />
            <FitText />
            {props.children}
          </div>
        </AppDataProvider>
      </body>
    </html>
  );
}

/** The inline script that sets data-theme from the active device profile, else the platform default. */
function themeBoot(platform: unknown) {
  const fallback = JSON.stringify(typeof platform === "string" ? platform : "light");
  return `try{var d=JSON.parse(localStorage.getItem(${JSON.stringify(DEVICE_KEY)})||"{}"),p=(d.profiles||[]).find(function(x){return x.id===d.activeId})||{},m=(p.settings||{})["display.themeMode"]||${fallback};document.documentElement.dataset.theme=m==="dark"||m==="system"?m:"light"}catch(e){}`;
}
