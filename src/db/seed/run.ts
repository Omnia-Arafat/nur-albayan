import { and, eq, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import * as s from "../schema";
import type { SeedData } from "./files";

// Any drizzle Postgres database (postgres-js in the app, PGlite in tests).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = PgDatabase<PgQueryResultHKT, any>;

/** "excluded.<col>" for every listed column, for ON CONFLICT DO UPDATE. */
const excluded = (cols: string[]) =>
  Object.fromEntries(cols.map((c) => [c, sql.raw(`excluded."${c.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)}"`)]));

function i18nRows<T extends Record<string, unknown>>(key: string, i18n: Record<string, T>) {
  return Object.entries(i18n).map(([locale, fields]) => ({ entityKey: key, locale, ...fields }));
}

/**
 * Load the seed into the database. Idempotent: rows are upserted by their natural key,
 * so running it again updates values without duplicating anything. Rows the seed does
 * not mention (admin edits, new content) are left alone.
 */
export async function runSeed(db: AnyDb, data: SeedData) {
  await db.transaction(async (tx) => {
    // platform
    await tx
      .insert(s.locales)
      .values(data.locales)
      .onConflictDoUpdate({
        target: s.locales.code,
        set: excluded(["name", "dir", "numberingSystem", "isDefault", "enabled", "position"]),
      });

    for (const [locale, namespaces] of Object.entries(data.uiMessages)) {
      const rows = Object.entries(namespaces).flatMap(([namespace, msgs]) =>
        Object.entries(msgs).map(([key, value]) => ({ namespace, key, locale, value })),
      );
      for (let i = 0; i < rows.length; i += 500) {
        await tx
          .insert(s.uiMessages)
          .values(rows.slice(i, i + 500))
          .onConflictDoNothing({ target: [s.uiMessages.namespace, s.uiMessages.key, s.uiMessages.locale] });
      }
    }

    await tx
      .insert(s.settingDefinitions)
      .values(data.settings.map((d) => ({ ...d, options: d.options ?? null })))
      .onConflictDoUpdate({
        target: s.settingDefinitions.key,
        set: excluded(["type", "options", "min", "max", "step", "defaultValue", "allowedScopes", "group", "position"]),
      });

    // theme
    const [theme] = await tx
      .insert(s.themes)
      .values(data.theme.theme)
      .onConflictDoUpdate({ target: s.themes.slug, set: excluded(["name", "mode"]) })
      .returning({ id: s.themes.id });
    await tx
      .insert(s.designTokens)
      .values(data.theme.tokens.map((t) => ({ ...t, themeId: theme.id })))
      .onConflictDoNothing({ target: [s.designTokens.themeId, s.designTokens.key] });

    for (const font of data.fonts) {
      const existing = await tx
        .select({ id: s.fonts.id })
        .from(s.fonts)
        .where(and(eq(s.fonts.role, font.role), eq(s.fonts.family, font.family)));
      if (existing.length === 0) await tx.insert(s.fonts).values(font);
    }

    await tx
      .insert(s.semanticRoles)
      .values(data.semanticRoles.map(({ i18n: _i18n, ...r }) => r))
      .onConflictDoNothing();
    await tx
      .insert(s.semanticRolesI18n)
      .values(data.semanticRoles.flatMap((r) => i18nRows(r.key, r.i18n)))
      .onConflictDoNothing();

    await tx.insert(s.pillPalettes).values(data.pillPalettes).onConflictDoNothing({ target: s.pillPalettes.slug });

    // content registries
    await tx
      .insert(s.cardTypes)
      .values(data.cardTypes.map(({ i18n: _i18n, ...c }) => c))
      .onConflictDoNothing();
    await tx
      .insert(s.cardTypesI18n)
      .values(data.cardTypes.flatMap((c) => i18nRows(c.key, c.i18n)))
      .onConflictDoNothing();

    // scoring and games
    await tx
      .insert(s.scoringProfiles)
      .values(data.scoringProfile)
      .onConflictDoNothing({ target: [s.scoringProfiles.slug, s.scoringProfiles.version] });

    await tx
      .insert(s.games)
      .values(data.games.map(({ i18n: _i18n, ...g }) => g))
      .onConflictDoNothing();
    await tx
      .insert(s.gamesI18n)
      .values(data.games.flatMap((g) => i18nRows(g.key, g.i18n)))
      .onConflictDoNothing();

    const haveFeedback = await tx.select({ n: sql<number>`count(*)::int` }).from(s.feedbackMessages);
    if (haveFeedback[0].n === 0) await tx.insert(s.feedbackMessages).values(data.feedbackMessages);

    // people
    await tx
      .insert(s.roles)
      .values(data.roles.roles.map(({ i18n: _i18n, ...r }) => r))
      .onConflictDoNothing();
    await tx
      .insert(s.rolesI18n)
      .values(data.roles.roles.flatMap((r) => i18nRows(r.key, r.i18n)))
      .onConflictDoNothing();
    await tx
      .insert(s.permissions)
      .values(data.roles.permissions.map(({ key }) => ({ key })))
      .onConflictDoNothing();
    await tx
      .insert(s.permissionsI18n)
      .values(data.roles.permissions.flatMap((p) => i18nRows(p.key, p.i18n)))
      .onConflictDoNothing();
    await tx
      .insert(s.rolePermissions)
      .values(
        Object.entries(data.roles.rolePermissions).flatMap(([roleKey, keys]) =>
          keys.map((permissionKey) => ({ roleKey, permissionKey })),
        ),
      )
      .onConflictDoNothing();

    const haveAvatars = await tx.select({ n: sql<number>`count(*)::int` }).from(s.avatars);
    if (haveAvatars[0].n === 0) await tx.insert(s.avatars).values(data.avatars.avatars);
    await tx.insert(s.avatarColors).values(data.avatars.colors).onConflictDoNothing({ target: s.avatarColors.tokenKey });

    // gamification
    await tx
      .insert(s.levels)
      .values(data.levels.map(({ i18n: _i18n, ...l }) => l))
      .onConflictDoNothing();
    await tx
      .insert(s.levelsI18n)
      .values(data.levels.flatMap((l) => i18nRows(l.key, l.i18n)))
      .onConflictDoNothing();
    await tx
      .insert(s.badges)
      .values(data.badges.map(({ i18n: _i18n, ...b }) => b))
      .onConflictDoNothing();
    await tx
      .insert(s.badgesI18n)
      .values(data.badges.flatMap((b) => i18nRows(b.key, b.i18n)))
      .onConflictDoNothing();
  });
}
