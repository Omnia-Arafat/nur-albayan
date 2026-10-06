import {
  type AnyPgColumn,
  type PgColumnBuilderBase,
  pgTable,
  primaryKey,
  text,
  uuid,
} from "drizzle-orm/pg-core";

import { locales } from "./platform";

/**
 * Translation table for an entity with a uuid id: one row per (entity, locale).
 * Every human-readable field of an entity lives here, never on the entity itself.
 */
export function translationsFor<TCols extends Record<string, PgColumnBuilderBase>>(
  name: string,
  parentId: () => AnyPgColumn,
  columns: TCols,
) {
  return pgTable(
    name,
    {
      entityId: uuid("entity_id")
        .notNull()
        .references(parentId, { onDelete: "cascade" }),
      locale: text("locale")
        .notNull()
        .references(() => locales.code, { onUpdate: "cascade" }),
      ...columns,
    },
    (t) => [primaryKey({ columns: [t.entityId, t.locale] })],
  ).enableRLS();
}

/** Same as translationsFor, for registries keyed by a text key (card types, games, badges...). */
export function translationsForKey<TCols extends Record<string, PgColumnBuilderBase>>(
  name: string,
  parentKey: () => AnyPgColumn,
  columns: TCols,
) {
  return pgTable(
    name,
    {
      entityKey: text("entity_key")
        .notNull()
        .references(parentKey, { onDelete: "cascade", onUpdate: "cascade" }),
      locale: text("locale")
        .notNull()
        .references(() => locales.code, { onUpdate: "cascade" }),
      ...columns,
    },
    (t) => [primaryKey({ columns: [t.entityKey, t.locale] })],
  ).enableRLS();
}
