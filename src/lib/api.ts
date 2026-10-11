import "server-only";

import { z } from "zod";

import { getDb } from "@/db/client";
import { getLocales } from "@/modules/i18n/service";

/** JSON response with the API's cache header. Content changes only when an editor publishes. */
export const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "cache-control": "public, max-age=60, stale-while-revalidate=600" } });

export const problem = (status: number, title: string, detail?: unknown) =>
  Response.json({ title, detail }, { status, headers: { "content-type": "application/problem+json" } });

/** ?locale= checked against the enabled locales; missing means the default locale. */
export async function localeFrom(req: Request) {
  const db = await getDb();
  const all = await getLocales(db);
  const asked = new URL(req.url).searchParams.get("locale");
  const found = asked ? all.find((l) => l.code === asked) : all.find((l) => l.isDefault);
  return { db, locale: found?.code ?? null, locales: all };
}

export const pageParam = z.coerce.number().int().positive();
