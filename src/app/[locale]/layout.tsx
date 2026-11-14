import "../globals.css";

import { eq } from "drizzle-orm";
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";

import { AppDataProvider } from "@/components/app/app-data";
import { BookFontNotice } from "@/components/app/book-font";
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
        {/* After the font stylesheets, so it runs once they are in: book words stay hidden until their font is ready. */}
        <script dangerouslySetInnerHTML={{ __html: bookFontBoot(theme.bookFonts) }} />
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
            <BookFontNotice />
            <OfflineSupport />
            <FitText />
            {props.children}
          </div>
        </AppDataProvider>
      </body>
    </html>
  );
}

/**
 * The inline script that waits for the book fonts and sets data-book-font on <html>: "ready" once every
 * book font has loaded its Arabic letters and Qur'anic marks, "failed" if one cannot load. Until "ready",
 * book.css hides book words, so a word is never drawn in a fallback font that lacks its marks (a letter
 * with the Uthmani sukun or an open tanween would vanish). A browser without the font loading API is
 * left as "ready".
 */
function bookFontBoot(families: string[]) {
  // Hamza, an open kasratan and the Uthmani sukun: the Arabic face and its Qur'anic marks.
  const sample = JSON.stringify("\u0621\u08F2\u06E1");
  const fonts = JSON.stringify(families.flatMap((f) => [`400 1em '${f.replace(/'/g, "")}'`, `700 1em '${f.replace(/'/g, "")}'`]));
  return `(function(){var r=document.documentElement,done=0;function set(v){r.dataset.bookFont=v;try{window.dispatchEvent(new Event("nb-book-font"))}catch(e){}}if(!document.fonts||!document.fonts.load){set("ready");return}Promise.all(${fonts}.map(function(f){return document.fonts.load(f,${sample})})).then(function(all){done=1;set(all.every(function(faces){return faces.length&&faces.every(function(x){return x.status==="loaded"})})?"ready":"failed")},function(){done=1;set("failed")});setTimeout(function(){if(!done)set("failed")},${BOOK_FONT_WAIT_MS})})()`;
}

/** How long a book word may wait for its font before the reader is told it could not load. */
const BOOK_FONT_WAIT_MS = 15000;

/** The inline script that sets data-theme from the active device profile, else the platform default. */
function themeBoot(platform: unknown) {
  const fallback = JSON.stringify(typeof platform === "string" ? platform : "light");
  return `try{var d=JSON.parse(localStorage.getItem(${JSON.stringify(DEVICE_KEY)})||"{}"),p=(d.profiles||[]).find(function(x){return x.id===d.activeId})||{},m=(p.settings||{})["display.themeMode"]||${fallback};document.documentElement.dataset.theme=m==="dark"||m==="system"?m:"light"}catch(e){}`;
}
