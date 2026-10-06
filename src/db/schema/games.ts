import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { id, timestamps } from "./_columns";
import { translationsForKey } from "./_i18n";
import { assets, lessons } from "./content";
import { locales } from "./platform";

/**
 * Every number the game uses: points per card type and surface, the score floor,
 * star thresholds, repeat policy, mastery streak. Versioned: an attempt keeps the
 * version it was scored with, so editing numbers never rewrites history.
 * Shape: src/modules/scoring/profile.ts (ScoringRules).
 */
export const scoringProfiles = pgTable(
  "scoring_profiles",
  {
    id: id(),
    slug: text("slug").notNull(),
    version: integer("version").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    rules: jsonb("rules").notNull(),
    ...timestamps(),
  },
  (t) => [unique().on(t.slug, t.version)],
).enableRLS();

export const gameKind = pgEnum("game_kind", ["break", "wordwall"]);

/** Game registry. Each key maps to a renderer; everything else about the game is config. */
export const games = pgTable("games", {
  key: text("key").primaryKey(),
  kind: gameKind("kind").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  position: integer("position").notNull().default(0),
  iconKey: text("icon_key").notNull(),
  fillTokenKey: text("fill_token_key").notNull(),
  defaultConfig: jsonb("default_config").notNull().default({}),
}).enableRLS();

export const gamesI18n = translationsForKey("games_i18n", () => games.key, {
  name: text("name").notNull(),
  description: text("description"),
});

export const lessonGameOverrides = pgTable(
  "lesson_game_overrides",
  {
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    gameKey: text("game_key")
      .notNull()
      .references(() => games.key, { onDelete: "cascade", onUpdate: "cascade" }),
    enabled: boolean("enabled"),
    config: jsonb("config").notNull().default({}),
  },
  (t) => [primaryKey({ columns: [t.lessonId, t.gameKey] })],
).enableRLS();

/** Cheers and gentle misses, picked at random by weight. `{points}` and `{name}` are filled at runtime. */
export const feedbackMessages = pgTable("feedback_messages", {
  id: id(),
  /** correct, wrong, danger_wrong, speed_correct, peak, mastered, lesson_complete, badge, break... */
  kind: text("kind").notNull(),
  locale: text("locale")
    .notNull()
    .references(() => locales.code, { onUpdate: "cascade" }),
  text: text("text").notNull(),
  weight: integer("weight").notNull().default(1),
  soundAssetId: uuid("sound_asset_id").references(() => assets.id, { onDelete: "set null" }),
  ...timestamps(),
}).enableRLS();
