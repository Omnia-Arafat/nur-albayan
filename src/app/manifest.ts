import type { MetadataRoute } from "next";

import { getDb } from "@/db/client";
import { getLocales, getMessages } from "@/modules/i18n/service";
import { brandTokenValues } from "@/modules/theme/service";

/** The install manifest, in the default locale, with the theme's paper and ink colours. */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const db = await getDb();
  const locales = await getLocales(db);
  const def = locales.find((l) => l.isDefault) ?? locales[0];
  const [messages, tokens] = await Promise.all([getMessages(db, def.code), brandTokenValues()]);
  const name = messages.app?.["brand.name"] ?? "";
  return {
    name,
    short_name: name,
    description: messages.app?.["brand.tagline"],
    lang: def.code,
    dir: def.dir,
    start_url: `/${def.code}`,
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: tokens.get("color.paper"),
    theme_color: tokens.get("color.paper"),
    icons: [
      { src: "/app-icon/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app-icon/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/app-icon/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
