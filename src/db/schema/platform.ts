import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { id, timestamps } from "./_columns";

export const textDirection = pgEnum("text_direction", ["rtl", "ltr"]);

/** Languages the platform can show. Adding a language is a row here plus its messages. */
export const locales = pgTable("locales", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  dir: textDirection("dir").notNull(),
  numberingSystem: text("numbering_system").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  enabled: boolean("enabled").notNull().default(true),
  position: integer("position").notNull().default(0),
}).enableRLS();

/** Every UI string, keyed by namespace + key, per locale. */
export const uiMessages = pgTable(
  "ui_messages",
  {
    id: id(),
    namespace: text("namespace").notNull(),
    key: text("key").notNull(),
    locale: text("locale")
      .notNull()
      .references(() => locales.code, { onUpdate: "cascade" }),
    value: text("value").notNull(),
    ...timestamps(),
  },
  (t) => [unique().on(t.namespace, t.key, t.locale)],
).enableRLS();

export const settingType = pgEnum("setting_type", ["boolean", "integer", "enum", "string", "json"]);
export const settingScope = pgEnum("setting_scope", ["platform", "classroom", "teacher", "student", "device"]);

/**
 * What settings exist, their type, limits and default. The admin and teacher settings
 * screens are rendered from these rows, so a new setting needs no UI code.
 */
export const settingDefinitions = pgTable("setting_definitions", {
  key: text("key").primaryKey(),
  type: settingType("type").notNull(),
  options: jsonb("options").$type<string[]>(),
  min: integer("min"),
  max: integer("max"),
  step: integer("step"),
  defaultValue: jsonb("default_value").notNull(),
  allowedScopes: settingScope("allowed_scopes").array().notNull(),
  group: text("group").notNull(),
  position: integer("position").notNull().default(0),
}).enableRLS();

/** A setting value at one scope. Resolution: device > student > classroom > teacher > platform > definition default. */
export const settings = pgTable(
  "settings",
  {
    id: id(),
    scope: settingScope("scope").notNull(),
    scopeId: uuid("scope_id"),
    key: text("key")
      .notNull()
      .references(() => settingDefinitions.key, { onDelete: "cascade", onUpdate: "cascade" }),
    value: jsonb("value").notNull(),
    ...timestamps(),
  },
  (t) => [unique().on(t.scope, t.scopeId, t.key).nullsNotDistinct()],
).enableRLS();
