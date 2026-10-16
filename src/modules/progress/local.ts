/**
 * Progress kept on the device, so the app works with no account (plan §8).
 * Several learners can share a device: each has a local profile with its own records.
 * Pure functions over a plain object; the browser store (store.ts) persists it.
 */
import { z } from "zod";

import {
  applySession,
  effectiveScore,
  emptyRecord,
  masteryStep,
  type ScoredAttempt,
  type SessionSummary,
  summarize,
} from "@/modules/scoring/engine";
import type { ScoringRules } from "@/modules/scoring/profile";

const record = z.object({
  bestScore: z.number(),
  latestScore: z.number(),
  cumulativeScore: z.number(),
  stars: z.number(),
  completedCount: z.number(),
});

const segment = z.object({ text: z.string(), role: z.string() });

const mistake = z.object({
  itemId: z.string(),
  bookPage: z.number(),
  segments: z.array(segment),
  missCount: z.number(),
  correctStreak: z.number(),
  mastered: z.boolean(),
  updatedAt: z.string(),
});

export const localProfile = z.object({
  id: z.string(),
  name: z.string(),
  avatar: z.object({ kind: z.enum(["letter", "icon"]), value: z.string() }),
  colorTokenKey: z.string(),
  createdAt: z.string(),
  records: z.record(z.string(), record).default({}),
  mistakes: z.record(z.string(), mistake).default({}),
  badges: z.array(z.string()).default([]),
  /** Days the learner read, as YYYY-MM-DD in local time. */
  days: z.array(z.string()).default([]),
  /** Pages finished per day, for the daily goal. */
  pagesByDay: z.record(z.string(), z.number()).default({}),
  peaks: z.number().default(0),
  /** Points won in games (word wall, ladder); they count toward the level like lesson points. */
  gamePoints: z.number().default(0),
  settings: z.record(z.string(), z.unknown()).default({}),
  /**
   * Set once the learner keeps this profile in an account: the student it saves to, and the pages and
   * words the account held at the last sync (so a page a teacher started over goes here too).
   */
  link: z
    .object({
      studentId: z.string(),
      pages: z.array(z.string()).default([]),
      words: z.array(z.string()).default([]),
      at: z.string(),
    })
    .optional(),
});
export type LocalProfile = z.infer<typeof localProfile>;
export type Mistake = z.infer<typeof mistake>;

export const deviceState = z.object({
  v: z.literal(1),
  activeId: z.string().nullable(),
  profiles: z.array(localProfile),
});
export type DeviceState = z.infer<typeof deviceState>;

export const emptyState: DeviceState = { v: 1, activeId: null, profiles: [] };

export const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function newProfile(
  id: string,
  name: string,
  avatar: LocalProfile["avatar"],
  colorTokenKey: string,
  now = new Date(),
): LocalProfile {
  return localProfile.parse({ id, name, avatar, colorTokenKey, createdAt: now.toISOString() });
}

export const active = (s: DeviceState) => s.profiles.find((p) => p.id === s.activeId) ?? s.profiles[0] ?? null;

/** Days in a row up to today (or yesterday, so the streak survives until the learner reads today). */
export function streakOf(p: LocalProfile, today = new Date()): number {
  const set = new Set(p.days);
  const d = new Date(today);
  if (!set.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (set.has(dayKey(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export const totalStars = (p: LocalProfile) => Object.values(p.records).reduce((n, r) => n + r.stars, 0);

/** Points toward levels: per finished page and per star (gamification.* settings), plus the page's score. */
export const xpOf = (p: LocalProfile, rules: ScoringRules, xp: { perLesson: number; perStar: number }) =>
  Object.values(p.records)
    .filter((r) => r.completedCount > 0)
    .reduce((n, r) => n + xp.perLesson + r.stars * xp.perStar + effectiveScore(rules.repeatPolicy, r), p.gamePoints);

export type Level = { key: string; position: number; xpThreshold: number; name: string };
export function levelOf<L extends Level>(levels: L[], xp: number): { current: L; next: L | null } {
  const sorted = [...levels].sort((a, b) => a.xpThreshold - b.xpThreshold);
  const current = [...sorted].reverse().find((l) => xp >= l.xpThreshold) ?? sorted[0];
  const next = sorted.find((l) => l.xpThreshold > xp) ?? null;
  return { current, next };
}

export type CardRead = {
  itemId: string;
  cardTypeKey: string;
  segments: { text: string; role: string }[];
  result: "correct" | "wrong";
  gradedBy: "self" | "teacher";
  /** A speed card read after its timer ran out. */
  timedOut?: boolean;
  /** The lesson ran with "no penalty", so a miss costs nothing. */
  noPenalty?: boolean;
};

/** Fold a finished lesson session into the profile: record, mistake bank, reading day. */
export function finishLesson(
  p: LocalProfile,
  rules: ScoringRules,
  bookPage: number,
  reads: CardRead[],
  now = new Date(),
): { profile: LocalProfile; summary: SessionSummary; missed: CardRead[] } {
  const attempts: ScoredAttempt[] = reads.map((r) => ({
    surface: "card",
    cardTypeKey: r.cardTypeKey,
    result: r.result,
    gradedBy: r.gradedBy,
    timedOut: r.timedOut,
    noPenalty: r.noPenalty,
  }));
  const summary = summarize(rules, attempts);
  const key = String(bookPage);
  const records = { ...p.records, [key]: applySession(p.records[key] ?? emptyRecord, summary) };
  const mistakes = { ...p.mistakes };
  for (const r of reads) {
    const prev = mistakes[r.itemId];
    if (!prev && r.result === "correct") continue;
    const base = prev ?? { missCount: 0, correctStreak: 0, mastered: false };
    const step = masteryStep(rules, base, r.result);
    mistakes[r.itemId] = { ...step, itemId: r.itemId, bookPage, segments: r.segments, updatedAt: now.toISOString() };
  }
  const day = dayKey(now);
  const days = p.days.includes(day) ? p.days : [...p.days, day];
  const pagesByDay = { ...p.pagesByDay, [day]: (p.pagesByDay[day] ?? 0) + 1 };
  const missed = reads
    .filter((r) => r.result === "wrong")
    .filter((r, i, all) => all.findIndex((x) => x.itemId === r.itemId) === i);
  return { profile: { ...p, records, mistakes, days, pagesByDay }, summary, missed };
}

/** One review read of a banked word. */
export function reviewMistake(
  p: LocalProfile,
  rules: ScoringRules,
  itemId: string,
  result: "correct" | "wrong",
  now = new Date(),
) {
  const m = p.mistakes[itemId];
  if (!m) return p;
  const step = masteryStep(rules, m, result);
  return { ...p, mistakes: { ...p.mistakes, [itemId]: { ...m, ...step, updatedAt: now.toISOString() } } };
}

/**
 * One graded word in a word game: its points go to the game total, and a miss goes to the mistake bank
 * (a right read of a banked word counts toward mastering it), so games are reading practice too.
 */
export function gameRead(
  p: LocalProfile,
  rules: ScoringRules,
  read: { itemId: string; bookPage: number; segments: { text: string; role: string }[]; result: "correct" | "wrong" },
  points: number,
  now = new Date(),
): LocalProfile {
  const prev = p.mistakes[read.itemId];
  const mistakes =
    !prev && read.result === "correct"
      ? p.mistakes
      : {
          ...p.mistakes,
          [read.itemId]: {
            ...masteryStep(rules, prev ?? { missCount: 0, correctStreak: 0, mastered: false }, read.result),
            itemId: read.itemId,
            bookPage: prev?.bookPage ?? read.bookPage,
            segments: prev?.segments ?? read.segments,
            updatedAt: now.toISOString(),
          },
        };
  return { ...p, gamePoints: p.gamePoints + points, mistakes };
}

export const openMistakes = (p: LocalProfile) => Object.values(p.mistakes).filter((m) => !m.mastered);
export const masteredCount = (p: LocalProfile) => Object.values(p.mistakes).filter((m) => m.mastered).length;

type Criteria = { type: string; count?: number; minStars?: number };
export type BadgeRule = { key: string; criteria: unknown };

/** Badges whose criteria the profile now meets. Rules are data (badges.criteria). */
export function earnedBadges(p: LocalProfile, badges: BadgeRule[], today = new Date()): string[] {
  const recs = Object.values(p.records);
  const value = (c: Criteria): number => {
    switch (c.type) {
      case "lessons_completed":
        return recs.filter((r) => r.completedCount > 0).length;
      case "lessons_with_stars":
        return recs.filter((r) => r.stars >= (c.minStars ?? 0)).length;
      case "streak_days":
        return streakOf(p, today);
      case "words_mastered":
        return masteredCount(p);
      case "ladder_peaks":
        return p.peaks;
      default:
        return 0;
    }
  };
  return badges.filter((b) => value(b.criteria as Criteria) >= ((b.criteria as Criteria).count ?? 1)).map((b) => b.key);
}

/**
 * Brings the account's copy into a device profile. Values only grow (the better score, the higher
 * count, the union of days and badges), except where the account dropped something it held at the last
 * sync: a page a teacher started over, or a word they cleared, goes from the device too.
 */
export function mergeRemote(local: LocalProfile, remote: LocalProfile): LocalProfile {
  const was = { pages: new Set(local.link?.pages ?? []), words: new Set(local.link?.words ?? []) };
  const records: LocalProfile["records"] = {};
  for (const page of new Set([...Object.keys(local.records), ...Object.keys(remote.records)])) {
    const a = local.records[page];
    const b = remote.records[page];
    if (!b) {
      if (a && !was.pages.has(page)) records[page] = a;
      continue;
    }
    records[page] = a
      ? {
          bestScore: Math.max(a.bestScore, b.bestScore),
          latestScore: a.latestScore,
          cumulativeScore: Math.max(a.cumulativeScore, b.cumulativeScore),
          stars: Math.max(a.stars, b.stars),
          completedCount: Math.max(a.completedCount, b.completedCount),
        }
      : b;
  }
  const mistakes: LocalProfile["mistakes"] = {};
  for (const id of new Set([...Object.keys(local.mistakes), ...Object.keys(remote.mistakes)])) {
    const a = local.mistakes[id];
    const b = remote.mistakes[id];
    if (!b) {
      if (a && !was.words.has(id)) mistakes[id] = a;
      continue;
    }
    if (!a) {
      mistakes[id] = b;
      continue;
    }
    const newer = a.updatedAt >= b.updatedAt ? a : b;
    mistakes[id] = {
      ...newer,
      missCount: Math.max(a.missCount, b.missCount),
      mastered: a.mastered || b.mastered,
      segments: a.segments.length ? a.segments : b.segments,
    };
  }
  const pagesByDay = { ...remote.pagesByDay };
  for (const [d, n] of Object.entries(local.pagesByDay)) pagesByDay[d] = Math.max(n, pagesByDay[d] ?? 0);
  return {
    ...local,
    records,
    mistakes,
    badges: [...new Set([...local.badges, ...remote.badges])],
    days: [...new Set([...local.days, ...remote.days])].sort(),
    pagesByDay,
    peaks: Math.max(local.peaks, remote.peaks),
    gamePoints: Math.max(local.gamePoints, remote.gamePoints),
  };
}

/** The link after a successful upload: the account now holds everything this profile has. */
export const linkedTo = (p: LocalProfile, studentId: string, now = new Date()): LocalProfile => ({
  ...p,
  link: { studentId, pages: Object.keys(p.records), words: Object.keys(p.mistakes), at: now.toISOString() },
});

/** A profile's progress without its sync bookkeeping, to tell whether anything new needs saving. */
export const progressKey = (p: LocalProfile) =>
  JSON.stringify([p.records, p.mistakes, p.badges, p.days, p.pagesByDay, p.gamePoints]);

/** A device backup file: what "Back up this device" saves, and "Restore" reads. */
export const deviceBackup = z.object({
  kind: z.literal("nur-albayan.device-backup"),
  savedAt: z.string(),
  device: deviceState,
});
export type DeviceBackup = z.infer<typeof deviceBackup>;

export const backupOf = (state: DeviceState, now = new Date()): DeviceBackup => ({
  kind: "nur-albayan.device-backup",
  savedAt: now.toISOString(),
  device: state,
});

/**
 * Brings a backup into this device without losing anything: a profile already here keeps the better of
 * each record (as when two devices sync), and new profiles are added. Returns the new state and how many
 * profiles were added or merged.
 */
export function restoreBackup(state: DeviceState, backup: DeviceBackup) {
  const profiles = [...state.profiles];
  let added = 0;
  let merged = 0;
  for (const p of backup.device.profiles) {
    const i = profiles.findIndex((x) => x.id === p.id);
    if (i < 0) {
      // Account links belong to the device that made them; the restored copy syncs again once kept.
      profiles.push({ ...p, link: undefined });
      added++;
    } else {
      const here = profiles[i];
      profiles[i] = { ...mergeRemote({ ...here, link: undefined }, p), link: here.link, settings: here.settings };
      merged++;
    }
  }
  return { state: { ...state, profiles, activeId: state.activeId ?? profiles[0]?.id ?? null }, added, merged };
}
