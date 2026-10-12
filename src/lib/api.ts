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

/** JSON for one signed-in person: never cached by browsers or CDNs. */
export const privateJson = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "cache-control": "private, no-store" } });

/** The signed-in viewer when they hold `permission`; otherwise the 401/403 problem to return. */
export async function guard(permission: string) {
  const { getViewer, can } = await import("@/modules/auth/viewer");
  const db = await getDb();
  const viewer = await getViewer(db);
  if (!viewer) return { db, viewer: null, error: problem(401, "Sign in first") } as const;
  if (!can(viewer, permission)) return { db, viewer: null, error: problem(403, "Not allowed") } as const;
  return { db, viewer, error: null } as const;
}

/** Parses a JSON body with a schema, or returns the 400 problem. */
export async function body<T>(req: Request, schema: z.ZodType<T>) {
  const parsed = schema.safeParse(await req.json().catch(() => undefined));
  return parsed.success
    ? ({ data: parsed.data, error: null } as const)
    : ({ data: null, error: problem(400, "Invalid body", z.flattenError(parsed.error as z.ZodError).fieldErrors) } as const);
}
