import "server-only";

import { and, asc, count, desc, eq, gte, isNotNull, isNull, sql } from "drizzle-orm";

import type { Db } from "@/db/client";
import * as s from "@/db/schema";
import { placeholders } from "@/modules/i18n/placeholders";

/* ---------- interface text ---------- */

export type MessageRow = { namespace: string; key: string; values: Record<string, string> };

/** Every interface text, one row per key with its value in each locale. */
export async function messageTable(db: Db): Promise<MessageRow[]> {
  const rows = await db.select().from(s.uiMessages).orderBy(asc(s.uiMessages.namespace), asc(s.uiMessages.key));
  const out = new Map<string, MessageRow>();
  for (const r of rows) {
    const id = `${r.namespace}\u0000${r.key}`;
    const row = out.get(id) ?? { namespace: r.namespace, key: r.key, values: {} };
    row.values[r.locale] = r.value;
    out.set(id, row);
  }
  return [...out.values()];
}

/**
 * Writes one text in one locale. Only keys the app already has can be written (the code asks for keys,
 * so a new one would never show), and a translation must keep the default text's placeholders.
 */
export async function setMessage(
  db: Db,
  input: { namespace: string; key: string; locale: string; value: string },
): Promise<{ ok: true } | { ok: false; error: "unknown" | "placeholders" }> {
  const existing = await db
    .select()
    .from(s.uiMessages)
    .where(and(eq(s.uiMessages.namespace, input.namespace), eq(s.uiMessages.key, input.key)));
  if (!existing.length) return { ok: false, error: "unknown" };
  const [def] = await db.select().from(s.locales).where(eq(s.locales.isDefault, true));
  const source = existing.find((r) => r.locale === def?.code) ?? existing[0];
  if (source.locale !== input.locale && placeholders(source.value).join() !== placeholders(input.value).join())
    return { ok: false, error: "placeholders" };
  await db
    .insert(s.uiMessages)
    .values({ ...input, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [s.uiMessages.namespace, s.uiMessages.key, s.uiMessages.locale],
      set: { value: input.value, updatedAt: new Date() },
    });
  return { ok: true };
}

/* ---------- badges and levels ---------- */

export type BadgeAdmin = {
  key: string;
  iconKey: string;
  fillTokenKey: string;
  enabled: boolean;
  criteria: { type: string; count?: number; minStars?: number };
  i18n: Record<string, { name: string; description: string }>;
};
export type LevelAdmin = {
  key: string;
  position: number;
  xpThreshold: number;
  iconKey: string;
  i18n: Record<string, string>;
};

export async function gamification(db: Db): Promise<{ badges: BadgeAdmin[]; levels: LevelAdmin[] }> {
  const [badges, badgeText, levels, levelText] = await Promise.all([
    db.select().from(s.badges).orderBy(asc(s.badges.position)),
    db.select().from(s.badgesI18n),
    db.select().from(s.levels).orderBy(asc(s.levels.position)),
    db.select().from(s.levelsI18n),
  ]);
  return {
    badges: badges.map((b) => ({
      key: b.key,
      iconKey: b.iconKey,
      fillTokenKey: b.fillTokenKey,
      enabled: b.enabled,
      criteria: b.criteria as BadgeAdmin["criteria"],
      i18n: Object.fromEntries(
        badgeText
          .filter((x) => x.entityKey === b.key)
          .map((x) => [x.locale, { name: x.name, description: x.description }]),
      ),
    })),
    levels: levels.map((l) => ({
      ...l,
      i18n: Object.fromEntries(levelText.filter((x) => x.entityKey === l.key).map((x) => [x.locale, x.name])),
    })),
  };
}

/** Turns a badge on or off, changes how many it needs, or renames it in one locale. */
export async function updateBadge(
  db: Db,
  key: string,
  patch: { enabled?: boolean; count?: number; locale?: string; name?: string; description?: string },
) {
  const [b] = await db.select().from(s.badges).where(eq(s.badges.key, key));
  if (!b) return false;
  await db.transaction(async (tx) => {
    const set: Partial<typeof s.badges.$inferInsert> = {};
    if (patch.enabled !== undefined) set.enabled = patch.enabled;
    if (patch.count !== undefined) set.criteria = { ...(b.criteria as object), count: patch.count };
    if (Object.keys(set).length) await tx.update(s.badges).set(set).where(eq(s.badges.key, key));
    if (patch.locale && patch.name !== undefined && patch.description !== undefined)
      await tx
        .insert(s.badgesI18n)
        .values({ entityKey: key, locale: patch.locale, name: patch.name, description: patch.description })
        .onConflictDoUpdate({
          target: [s.badgesI18n.entityKey, s.badgesI18n.locale],
          set: { name: patch.name, description: patch.description },
        });
  });
  return true;
}

/**
 * Changes a level's points threshold or its name in one locale. Thresholds must keep rising with the
 * level, and the first level always starts at zero.
 */
export async function updateLevel(
  db: Db,
  key: string,
  patch: { xpThreshold?: number; locale?: string; name?: string },
): Promise<{ ok: true } | { ok: false; error: "unknown" | "order" }> {
  const all = await db.select().from(s.levels).orderBy(asc(s.levels.position));
  const i = all.findIndex((l) => l.key === key);
  if (i < 0) return { ok: false, error: "unknown" };
  if (patch.xpThreshold !== undefined) {
    const below = all[i - 1]?.xpThreshold ?? -1;
    const above = all[i + 1]?.xpThreshold ?? Infinity;
    if ((i === 0 && patch.xpThreshold !== 0) || patch.xpThreshold <= below || patch.xpThreshold >= above)
      return { ok: false, error: "order" };
  }
  await db.transaction(async (tx) => {
    if (patch.xpThreshold !== undefined)
      await tx.update(s.levels).set({ xpThreshold: patch.xpThreshold }).where(eq(s.levels.key, key));
    if (patch.locale && patch.name)
      await tx
        .insert(s.levelsI18n)
        .values({ entityKey: key, locale: patch.locale, name: patch.name })
        .onConflictDoUpdate({ target: [s.levelsI18n.entityKey, s.levelsI18n.locale], set: { name: patch.name } });
  });
  return { ok: true };
}

/* ---------- platform numbers ---------- */

export type PlatformOverview = {
  days: number;
  learners: number;
  withAccount: number;
  teachers: number;
  classrooms: number;
  pages: { published: number; total: number };
  activeLearners: number;
  sessions: number;
  reads: number;
  accuracy: number | null;
  badgesEarned: number;
};

export async function platformOverview(db: Db, days = 7): Promise<PlatformOverview> {
  const since = new Date(Date.now() - days * 86_400_000);
  const [[learners], [withAccount], [teachers], [classrooms], pages, [active], [reads], [badges]] = await Promise.all([
    db.select({ n: count() }).from(s.students),
    db.select({ n: count() }).from(s.students).where(isNotNull(s.students.profileId)),
    db
      .select({ n: count() })
      .from(s.profiles)
      .where(sql`${s.profiles.roleKey} in ('teacher', 'admin')`),
    db.select({ n: count() }).from(s.classrooms).where(isNull(s.classrooms.archivedAt)),
    db.select({ status: s.lessons.status, n: count() }).from(s.lessons).groupBy(s.lessons.status),
    db
      .select({ learners: sql<number>`count(distinct ${s.sessions.studentId})`, sessions: count() })
      .from(s.sessions)
      .where(gte(s.sessions.finishedAt, since)),
    db
      .select({
        total: count(),
        correct: sql<number>`count(*) filter (where ${s.attempts.result} = 'correct')`,
      })
      .from(s.attempts)
      .where(and(gte(s.attempts.occurredAt, since), eq(s.attempts.surface, "card"))),
    db.select({ n: count() }).from(s.studentBadges),
  ]);
  const total = Number(reads?.total ?? 0);
  return {
    days,
    learners: Number(learners.n),
    withAccount: Number(withAccount.n),
    teachers: Number(teachers.n),
    classrooms: Number(classrooms.n),
    pages: {
      published: Number(pages.find((p) => p.status === "published")?.n ?? 0),
      total: pages.reduce((n, p) => n + Number(p.n), 0),
    },
    activeLearners: Number(active?.learners ?? 0),
    sessions: Number(active?.sessions ?? 0),
    reads: total,
    accuracy: total ? Number(reads.correct) / total : null,
    badgesEarned: Number(badges.n),
  };
}

/* ---------- design: theme colours ---------- */

export type ThemeColours = {
  slug: string;
  name: string;
  mode: "light" | "dark";
  isDefault: boolean;
  tokens: { key: string; value: string; description: string | null }[];
};

const HEX = /^#[0-9A-Fa-f]{6}$/;

/** Every theme's colour tokens. A night theme lists the default theme's colours too, with its own where set. */
export async function themeColours(db: Db): Promise<ThemeColours[]> {
  const [themeRows, tokens] = await Promise.all([
    db.select().from(s.themes).orderBy(desc(s.themes.isDefault), asc(s.themes.slug)),
    db.select().from(s.designTokens).where(eq(s.designTokens.group, "color")).orderBy(asc(s.designTokens.key)),
  ]);
  const base = themeRows.find((t) => t.isDefault);
  const baseTokens = tokens.filter((t) => t.themeId === base?.id);
  return themeRows.map((t) => ({
    slug: t.slug,
    name: t.name,
    mode: t.mode,
    isDefault: t.isDefault,
    tokens: baseTokens.map((b) => {
      const own = tokens.find((x) => x.themeId === t.id && x.key === b.key);
      return { key: b.key, value: (own ?? b).value, description: b.description };
    }),
  }));
}

/** Sets one colour of one theme. Only colours the default theme has can be set, and only as #RRGGBB. */
export async function setThemeColour(
  db: Db,
  input: { theme: string; key: string; value: string },
): Promise<{ ok: true } | { ok: false; error: "unknown" | "colour" }> {
  if (!HEX.test(input.value)) return { ok: false, error: "colour" };
  const [theme] = await db.select().from(s.themes).where(eq(s.themes.slug, input.theme));
  const [base] = await db.select().from(s.themes).where(eq(s.themes.isDefault, true));
  if (!theme || !base) return { ok: false, error: "unknown" };
  const [known] = await db
    .select()
    .from(s.designTokens)
    .where(
      and(eq(s.designTokens.themeId, base.id), eq(s.designTokens.key, input.key), eq(s.designTokens.group, "color")),
    );
  if (!known) return { ok: false, error: "unknown" };
  await db
    .insert(s.designTokens)
    .values({
      themeId: theme.id,
      group: "color",
      key: input.key,
      value: input.value.toUpperCase(),
      description: known.description,
    })
    .onConflictDoUpdate({
      target: [s.designTokens.themeId, s.designTokens.key],
      set: { value: input.value.toUpperCase() },
    });
  return { ok: true };
}
