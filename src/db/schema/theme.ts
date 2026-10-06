import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { id, timestamps } from "./_columns";
import { translationsForKey } from "./_i18n";

export const themeMode = pgEnum("theme_mode", ["light", "dark"]);
export const tokenGroup = pgEnum("token_group", [
  "color",
  "font",
  "font_size",
  "font_weight",
  "radius",
  "space",
  "shadow",
  "motion",
  "border",
]);
export const fontRole = pgEnum("font_role", ["display", "naskh", "quran", "ui"]);

/** A named set of tokens. The book's cream-paper look is the default light theme. */
export const themes = pgTable("themes", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  mode: themeMode("mode").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  version: integer("version").notNull().default(1),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  ...timestamps(),
}).enableRLS();

/** One design token, e.g. color.paper = #FEFBDA. Compiled to a CSS variable --nb-color-paper. */
export const designTokens = pgTable(
  "design_tokens",
  {
    id: id(),
    themeId: uuid("theme_id")
      .notNull()
      .references(() => themes.id, { onDelete: "cascade" }),
    group: tokenGroup("group").notNull(),
    key: text("key").notNull(),
    value: text("value").notNull(),
    description: text("description"),
    ...timestamps(),
  },
  (t) => [unique().on(t.themeId, t.key)],
).enableRLS();

/** Font families by role. A font file is an uploaded asset; a hosted font is a css_url. */
export const fonts = pgTable("fonts", {
  id: id(),
  role: fontRole("role").notNull(),
  family: text("family").notNull(),
  fallbacks: text("fallbacks").notNull(),
  cssUrl: text("css_url"),
  assetPath: text("asset_path"),
  weights: integer("weights").array().notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  ...timestamps(),
}).enableRLS();

/**
 * The book's teaching colour grammar: content marks a segment as "target", "contrast"...
 * and the role points at a token. Re-pointing a role restyles every lesson at once.
 */
export const semanticRoles = pgTable("semantic_roles", {
  key: text("key").primaryKey(),
  tokenKey: text("token_key").notNull(),
  position: integer("position").notNull().default(0),
}).enableRLS();

export const semanticRolesI18n = translationsForKey("semantic_roles_i18n", () => semanticRoles.key, {
  label: text("label").notNull(),
  description: text("description"),
});

/** Ordered pill fills cycled by row band (the book changes colour every N rows). */
export const pillPalettes = pgTable("pill_palettes", {
  id: id(),
  slug: text("slug").notNull().unique(),
  fillTokenKeys: text("fill_token_keys").array().notNull(),
  rowsPerColor: integer("rows_per_color").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
}).enableRLS();
