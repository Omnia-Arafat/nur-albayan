import "server-only";

import { and, asc, eq, isNull, sql } from "drizzle-orm";

import type { Db } from "@/db/client";
import * as s from "@/db/schema";

export type Scope = (typeof s.settingScope.enumValues)[number];
export type Definition = typeof s.settingDefinitions.$inferSelect;

/** Setting definitions that may be set at a scope, in admin order, with the value stored there (if any). */
export async function settingsAt(db: Db, scope: Scope, scopeId: string | null) {
  const [defs, values] = await Promise.all([
    db.select().from(s.settingDefinitions).orderBy(asc(s.settingDefinitions.group), asc(s.settingDefinitions.position)),
    db
      .select()
      .from(s.settings)
      .where(and(eq(s.settings.scope, scope), scopeId ? eq(s.settings.scopeId, scopeId) : isNull(s.settings.scopeId))),
  ]);
  return defs
    .filter((d) => d.allowedScopes.includes(scope))
    .map((d) => {
      const v = values.find((x) => x.key === d.key);
      return { ...d, value: v ? v.value : d.defaultValue, isSet: Boolean(v) };
    });
}

/** Checks a value against its definition; returns the clean value or an error message. */
export function validate(def: Definition, value: unknown): { ok: true; value: unknown } | { ok: false; error: string } {
  switch (def.type) {
    case "boolean":
      return typeof value === "boolean" ? { ok: true, value } : { ok: false, error: "expected a boolean" };
    case "integer": {
      if (typeof value !== "number" || !Number.isInteger(value)) return { ok: false, error: "expected an integer" };
      if (def.min != null && value < def.min) return { ok: false, error: `at least ${def.min}` };
      if (def.max != null && value > def.max) return { ok: false, error: `at most ${def.max}` };
      return { ok: true, value };
    }
    case "enum":
      return typeof value === "string" && (def.options ?? []).includes(value)
        ? { ok: true, value }
        : { ok: false, error: `one of ${(def.options ?? []).join(", ")}` };
    default:
      return value === undefined ? { ok: false, error: "missing value" } : { ok: true, value };
  }
}

export async function setSetting(db: Db, scope: Scope, scopeId: string | null, key: string, value: unknown) {
  const [def] = await db.select().from(s.settingDefinitions).where(eq(s.settingDefinitions.key, key));
  if (!def) return { ok: false as const, error: "unknown setting" };
  if (!def.allowedScopes.includes(scope)) return { ok: false as const, error: `cannot be set for a ${scope}` };
  const v = validate(def, value);
  if (!v.ok) return v;
  await db
    .insert(s.settings)
    .values({ scope, scopeId, key, value: v.value as object })
    .onConflictDoUpdate({
      target: [s.settings.scope, s.settings.scopeId, s.settings.key],
      set: { value: sql`excluded.value`, updatedAt: sql`now()` },
    });
  return { ok: true as const, value: v.value };
}
