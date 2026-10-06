import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { id, timestamps } from "./_columns";
import { translationsFor, translationsForKey } from "./_i18n";
import { pillPalettes, semanticRoles } from "./theme";

export const assetKind = pgEnum("asset_kind", ["image", "audio", "font", "scan", "other"]);
export const contentStatus = pgEnum("content_status", ["draft", "review", "published", "archived"]);
export const sectionKind = pgEnum("section_kind", [
  "letter_tiles",
  "picture_grid",
  "segmented_rows",
  "word_rows",
  "sentences",
  "story",
  "rule_table",
  "rule_definition",
]);
export const scriptKind = pgEnum("script_kind", ["naskh", "uthmani"]);

/** Files in Supabase Storage: photos, audio, page scans. */
export const assets = pgTable("assets", {
  id: id(),
  kind: assetKind("kind").notNull(),
  storagePath: text("storage_path").notNull().unique(),
  mimeType: text("mime_type").notNull(),
  width: integer("width"),
  height: integer("height"),
  ...timestamps(),
}).enableRLS();

export const assetsI18n = translationsFor("assets_i18n", () => assets.id, {
  alt: text("alt").notNull(),
});

export const books = pgTable("books", {
  id: id(),
  slug: text("slug").notNull().unique(),
  edition: text("edition"),
  coverAssetId: uuid("cover_asset_id").references(() => assets.id, { onDelete: "set null" }),
  ...timestamps(),
}).enableRLS();

export const booksI18n = translationsFor("books_i18n", () => books.id, {
  title: text("title").notNull(),
  subtitle: text("subtitle"),
});

/** The book's teaching stages (letters, harakat, madd, shaddah and tanween, tajweed, rasm, review). */
export const stages = pgTable(
  "stages",
  {
    id: id(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    tagTokenKey: text("tag_token_key"),
    ...timestamps(),
  },
  (t) => [unique().on(t.bookId, t.position)],
).enableRLS();

export const stagesI18n = translationsFor("stages_i18n", () => stages.id, {
  title: text("title").notNull(),
  description: text("description"),
});

export const units = pgTable(
  "units",
  {
    id: id(),
    stageId: uuid("stage_id")
      .notNull()
      .references(() => stages.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    ...timestamps(),
  },
  (t) => [unique().on(t.stageId, t.position)],
).enableRLS();

export const unitsI18n = translationsFor("units_i18n", () => units.id, {
  title: text("title").notNull(),
});

/** One printed page of the book = one lesson. */
export const lessons = pgTable(
  "lessons",
  {
    id: id(),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => units.id, { onDelete: "cascade" }),
    slug: text("slug").notNull().unique(),
    bookPage: integer("book_page").notNull(),
    position: integer("position").notNull(),
    status: contentStatus("status").notNull().default("draft"),
    version: integer("version").notNull().default(1),
    scanAssetId: uuid("scan_asset_id").references(() => assets.id, { onDelete: "set null" }),
    /** Optional per-lesson scoring profile; null = platform default. */
    scoringProfileId: uuid("scoring_profile_id"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [unique().on(t.unitId, t.position), index().on(t.bookPage)],
).enableRLS();

export const lessonsI18n = translationsFor("lessons_i18n", () => lessons.id, {
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  /** "For the teacher and parents" footer. */
  teacherNote: text("teacher_note"),
  unitTag: text("unit_tag"),
  lessonTag: text("lesson_tag"),
  observeTag: text("observe_tag"),
});

/** A block on the page: a drill, a story box, a rule table... `kind` picks the renderer. */
export const lessonSections = pgTable(
  "lesson_sections",
  {
    id: id(),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    kind: sectionKind("kind").notNull(),
    pillPaletteId: uuid("pill_palette_id").references(() => pillPalettes.id, { onDelete: "set null" }),
    /** Renderer options validated per kind (columns per row, frame token, image side...). */
    config: jsonb("config").notNull().default({}),
    ...timestamps(),
  },
  (t) => [unique().on(t.lessonId, t.position)],
).enableRLS();

export const lessonSectionsI18n = translationsFor("lesson_sections_i18n", () => lessonSections.id, {
  /** e.g. "تدريب (٢) أمثلة قرآنية". */
  label: text("label"),
  /** Story title, rule table caption. */
  title: text("title"),
});

/** Card categories (normal, golden, speed, danger). Points live in the scoring profile, not here. */
export const cardTypes = pgTable("card_types", {
  key: text("key").primaryKey(),
  iconKey: text("icon_key").notNull(),
  frameTokenKey: text("frame_token_key").notNull(),
  position: integer("position").notNull().default(0),
}).enableRLS();

export const cardTypesI18n = translationsForKey("card_types_i18n", () => cardTypes.key, {
  label: text("label").notNull(),
});

/** One readable thing: a letter, a word, a phrase, a verse, a story line. */
export const items = pgTable(
  "items",
  {
    id: id(),
    sectionId: uuid("section_id")
      .notNull()
      .references(() => lessonSections.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    cardTypeKey: text("card_type_key")
      .notNull()
      .references(() => cardTypes.key, { onUpdate: "cascade" }),
    script: scriptKind("script").notNull().default("naskh"),
    /** Row band for the pill colour cycle. */
    rowBand: integer("row_band").notNull().default(0),
    /** Whether the item is drilled as a card (stories and rule rows may be display only). */
    isDrillable: boolean("is_drillable").notNull().default(true),
    /** Decorative colour the book gives this item, e.g. each alphabet letter. Not a teaching colour. */
    tintTokenKey: text("tint_token_key"),
    imageAssetId: uuid("image_asset_id").references(() => assets.id, { onDelete: "set null" }),
    audioAssetId: uuid("audio_asset_id").references(() => assets.id, { onDelete: "set null" }),
    /** Plain text without tashkeel, for search and the mistake-bank list. */
    searchText: text("search_text").notNull(),
    ...timestamps(),
  },
  (t) => [unique().on(t.sectionId, t.position)],
).enableRLS();

export const itemsI18n = translationsFor("items_i18n", () => items.id, {
  meaning: text("meaning"),
  transliteration: text("transliteration"),
});

/**
 * The word as the book prints it: ordered segments, each with a teaching role.
 * «حِـ» base + «ي» target + «نَ» base. Never stored as HTML.
 */
export const itemSegments = pgTable(
  "item_segments",
  {
    id: id(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    text: text("text").notNull(),
    roleKey: text("role_key")
      .notNull()
      .references(() => semanticRoles.key, { onUpdate: "cascade" }),
    /** Draw a cell divider after this segment (segmented pills). */
    cellBreakAfter: boolean("cell_break_after").notNull().default(false),
  },
  (t) => [unique().on(t.itemId, t.position)],
).enableRLS();

/** Rule cards shown before and during a lesson. */
export const rules = pgTable(
  "rules",
  {
    id: id(),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    /** Example as segments: [{ text, role }, { op: "plus" | "equals" | "arrow" | "dash" }]. */
    example: jsonb("example").notNull().default([]),
    ...timestamps(),
  },
  (t) => [unique().on(t.lessonId, t.position)],
).enableRLS();

export const rulesI18n = translationsFor("rules_i18n", () => rules.id, {
  title: text("title").notNull(),
  description: text("description").notNull(),
});

export const riddles = pgTable("riddles", {
  id: id(),
  /** Null = available on any lesson that turns riddles on. */
  lessonId: uuid("lesson_id").references(() => lessons.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  answerIndex: integer("answer_index").notNull(),
  ...timestamps(),
}).enableRLS();

export const riddlesI18n = translationsFor("riddles_i18n", () => riddles.id, {
  question: text("question").notNull(),
  options: jsonb("options").$type<string[]>().notNull(),
});

/** Audit trail for editors: who changed what. */
export const contentRevisions = pgTable("content_revisions", {
  id: id(),
  entityTable: text("entity_table").notNull(),
  entityId: text("entity_id").notNull(),
  diff: jsonb("diff").notNull(),
  authorId: uuid("author_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();
