import { asc, eq } from "drizzle-orm";

import type { Db } from "@/db/client";
import * as s from "@/db/schema";
import { scoringRules } from "@/modules/scoring/profile";

const name = <T extends { entityKey: string; locale: string }>(rows: T[], key: string, locale: string, fb: string) =>
  rows.find((r) => r.entityKey === key && r.locale === locale) ??
  rows.find((r) => r.entityKey === key && r.locale === fb);

/** Registries the learner screens need: games, badges, levels, avatars, card types and the scoring rules. */
export async function getCatalog(db: Db, locale: string) {
  const [def] = await db.select().from(s.locales).where(eq(s.locales.isDefault, true));
  const fb = def?.code ?? locale;
  const [
    palettes,
    games,
    gamesI18n,
    badges,
    badgesI18n,
    levels,
    levelsI18n,
    avatars,
    colors,
    cardTypes,
    cardTypesI18n,
    profiles,
  ] = await Promise.all([
    db.select().from(s.pillPalettes),
    db.select().from(s.games).where(eq(s.games.enabled, true)).orderBy(asc(s.games.position)),
    db.select().from(s.gamesI18n),
    db.select().from(s.badges).where(eq(s.badges.enabled, true)).orderBy(asc(s.badges.position)),
    db.select().from(s.badgesI18n),
    db.select().from(s.levels).orderBy(asc(s.levels.position)),
    db.select().from(s.levelsI18n),
    db.select().from(s.avatars).orderBy(asc(s.avatars.position)),
    db.select().from(s.avatarColors).orderBy(asc(s.avatarColors.position)),
    db.select().from(s.cardTypes).orderBy(asc(s.cardTypes.position)),
    db.select().from(s.cardTypesI18n),
    db.select().from(s.scoringProfiles).where(eq(s.scoringProfiles.isDefault, true)),
  ]);
  const [defs, platform] = await Promise.all([
    db.select().from(s.settingDefinitions),
    db.select().from(s.settings).where(eq(s.settings.scope, "platform")),
  ]);
  // Platform values over definition defaults; classroom, student and device values are applied on top later.
  const settings: Record<string, unknown> = Object.fromEntries(defs.map((d) => [d.key, d.defaultValue]));
  for (const v of platform) settings[v.key] = v.value;
  return {
    games: games.map((g) => ({ ...g, name: name(gamesI18n, g.key, locale, fb)?.name ?? g.key })),
    badges: badges.map((b) => {
      const t = name(badgesI18n, b.key, locale, fb);
      return { ...b, name: t?.name ?? b.key, description: t?.description ?? "" };
    }),
    levels: levels.map((l) => ({ ...l, name: name(levelsI18n, l.key, locale, fb)?.name ?? l.key })),
    avatars: avatars.map(({ id, kind, value, unlockBadgeKey }) => ({ id, kind, value, unlockBadgeKey })),
    avatarColors: colors.map((c) => c.tokenKey),
    cardTypes: cardTypes.map((c) => ({ ...c, label: name(cardTypesI18n, c.key, locale, fb)?.label ?? c.key })),
    scoring: profiles[0] ? scoringRules.parse(profiles[0].rules) : null,
    settings,
    /** Pill palette keys (yellow, sky...) of the default palette, in the book's order. */
    palette: (palettes.find((p) => p.isDefault) ?? palettes[0])?.fillTokenKeys.map((k) => k.split(".").pop()!) ?? [],
  };
}

export type Catalog = Awaited<ReturnType<typeof getCatalog>>;
