import * as s from "@/db/schema";
import { guard } from "@/lib/api";

/**
 * Everything the platform is made of (the book's content, texts, design, scoring, rewards and settings)
 * as one JSON file, for safekeeping or moving to another install. People and their progress are left out.
 */
const TABLES = {
  books: s.books,
  booksI18n: s.booksI18n,
  stages: s.stages,
  stagesI18n: s.stagesI18n,
  units: s.units,
  unitsI18n: s.unitsI18n,
  lessons: s.lessons,
  lessonsI18n: s.lessonsI18n,
  lessonSections: s.lessonSections,
  lessonSectionsI18n: s.lessonSectionsI18n,
  items: s.items,
  itemsI18n: s.itemsI18n,
  itemSegments: s.itemSegments,
  rules: s.rules,
  rulesI18n: s.rulesI18n,
  cardTypes: s.cardTypes,
  cardTypesI18n: s.cardTypesI18n,
  assets: s.assets,
  locales: s.locales,
  uiMessages: s.uiMessages,
  settingDefinitions: s.settingDefinitions,
  settings: s.settings,
  themes: s.themes,
  designTokens: s.designTokens,
  fonts: s.fonts,
  semanticRoles: s.semanticRoles,
  games: s.games,
  gamesI18n: s.gamesI18n,
  scoringProfiles: s.scoringProfiles,
  feedbackMessages: s.feedbackMessages,
  badges: s.badges,
  badgesI18n: s.badgesI18n,
  levels: s.levels,
  levelsI18n: s.levelsI18n,
  avatars: s.avatars,
  avatarColors: s.avatarColors,
};

export async function GET() {
  const g = await guard("settings.platform");
  if (g.error) return g.error;
  const out: Record<string, unknown> = { kind: "nur-albayan.platform-export", exportedAt: new Date().toISOString() };
  for (const [name, table] of Object.entries(TABLES)) out[name] = await g.db.select().from(table);
  const day = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(out), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="nur-albayan-platform-${day}.json"`,
      "cache-control": "private, no-store",
    },
  });
}
