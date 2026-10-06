import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { id } from "./_columns";
import { translationsForKey } from "./_i18n";
import { items, lessons } from "./content";
import { scoringProfiles } from "./games";
import { profiles, students } from "./people";

/** One sitting with one lesson. */
export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    scoringProfileId: uuid("scoring_profile_id")
      .notNull()
      .references(() => scoringProfiles.id),
    /** Resolved settings at start (no-penalty, timer...), so the score can be recomputed. */
    settingsSnapshot: jsonb("settings_snapshot").notNull(),
    /** Set by the device, so an offline session uploaded twice is stored once. */
    clientSessionId: text("client_session_id").notNull().unique(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index().on(t.studentId, t.lessonId)],
).enableRLS();

export const attemptSurface = pgEnum("attempt_surface", ["card", "wordwall", "ladder", "review", "remediation"]);
export const attemptResult = pgEnum("attempt_result", ["correct", "wrong"]);
export const graderKind = pgEnum("grader_kind", ["self", "teacher"]);

/** Append-only log of every graded read. Everything else in progress is derived from it. */
export const attempts = pgTable(
  "attempts",
  {
    id: id(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    surface: attemptSurface("surface").notNull(),
    gameKey: text("game_key"),
    result: attemptResult("result").notNull(),
    timedOut: boolean("timed_out").notNull().default(false),
    points: integer("points").notNull(),
    gradedBy: graderKind("graded_by").notNull(),
    graderProfileId: uuid("grader_profile_id").references(() => profiles.id, { onDelete: "set null" }),
    clientEventId: text("client_event_id").notNull().unique(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  },
  (t) => [index().on(t.sessionId)],
).enableRLS();

/** Per student per lesson, recomputed from attempts with the repeat policy. */
export const lessonRecords = pgTable(
  "lesson_records",
  {
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    bestScore: integer("best_score").notNull().default(0),
    latestScore: integer("latest_score").notNull().default(0),
    cumulativeScore: integer("cumulative_score").notNull().default(0),
    accuracy: numeric("accuracy", { precision: 5, scale: 4 }).notNull().default("0"),
    stars: smallint("stars").notNull().default(0),
    completedCount: integer("completed_count").notNull().default(0),
    lastStudiedAt: timestamp("last_studied_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.studentId, t.lessonId] })],
).enableRLS();

/** Words a learner missed, until mastered (N correct in a row, N from the scoring profile). */
export const mistakeBank = pgTable(
  "mistake_bank",
  {
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    missCount: integer("miss_count").notNull().default(0),
    correctStreak: integer("correct_streak").notNull().default(0),
    lastMissedAt: timestamp("last_missed_at", { withTimezone: true }),
    masteredAt: timestamp("mastered_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.studentId, t.itemId] })],
).enableRLS();

export const xpSource = pgEnum("xp_source", ["lesson", "game", "review", "remediation", "badge", "streak", "daily_goal"]);

export const xpLedger = pgTable(
  "xp_ledger",
  {
    id: id(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    source: xpSource("source").notNull(),
    amount: integer("amount").notNull(),
    refId: text("ref_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.studentId)],
).enableRLS();

export const levels = pgTable("levels", {
  key: text("key").primaryKey(),
  position: integer("position").notNull().unique(),
  xpThreshold: integer("xp_threshold").notNull(),
  iconKey: text("icon_key").notNull(),
}).enableRLS();

export const levelsI18n = translationsForKey("levels_i18n", () => levels.key, {
  name: text("name").notNull(),
});

/** Badge rules are data: { type: "lessons_completed", count: 10, minStars: 2, stageId? }. */
export const badges = pgTable("badges", {
  key: text("key").primaryKey(),
  criteria: jsonb("criteria").notNull(),
  iconKey: text("icon_key").notNull(),
  fillTokenKey: text("fill_token_key").notNull(),
  position: integer("position").notNull().default(0),
  enabled: boolean("enabled").notNull().default(true),
}).enableRLS();

export const badgesI18n = translationsForKey("badges_i18n", () => badges.key, {
  name: text("name").notNull(),
  description: text("description").notNull(),
});

export const studentBadges = pgTable(
  "student_badges",
  {
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    badgeKey: text("badge_key")
      .notNull()
      .references(() => badges.key, { onDelete: "cascade", onUpdate: "cascade" }),
    awardedAt: timestamp("awarded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.studentId, t.badgeKey] })],
).enableRLS();

export const streaks = pgTable("streaks", {
  studentId: uuid("student_id")
    .primaryKey()
    .references(() => students.id, { onDelete: "cascade" }),
  current: integer("current").notNull().default(0),
  longest: integer("longest").notNull().default(0),
  lastActiveDay: date("last_active_day"),
}).enableRLS();
