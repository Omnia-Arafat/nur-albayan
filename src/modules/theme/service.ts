import { and, eq } from "drizzle-orm";

import motionSeed from "../../../seed/motion.json";
import iconSeed from "../../../seed/icons.json";
import themeSeed from "../../../seed/theme.book-light.json";
import { type Db, getDb } from "@/db/client";
import { designTokens, fonts, semanticRoles, themes } from "@/db/schema";

import { compileThemeCss } from "./css";
import { iconSet } from "./icons";
import { compileMotionCss, motionSet } from "./motion";

export const icons = iconSet.parse(iconSeed);
export const motion = motionSet.parse(motionSeed);

export type Theme = { css: string; fontUrls: string[] };

/** The default theme as one stylesheet (tokens, fonts, teaching roles, motion) plus the font stylesheets to load. */
export async function getTheme(db: Db): Promise<Theme> {
  const [theme] = await db.select().from(themes).where(eq(themes.isDefault, true));
  if (!theme) throw new Error("No default theme: run the seed");
  const tokens = await db.select().from(designTokens).where(eq(designTokens.themeId, theme.id));
  const fontRows = await db
    .select()
    .from(fonts)
    .where(and(eq(fonts.isDefault, true)));
  const roles = await db.select().from(semanticRoles);
  const css = compileThemeCss(tokens, fontRows, roles) + "\n" + compileMotionCss(motion);
  const fontUrls = [...new Set(fontRows.map((f) => f.cssUrl).filter((u): u is string => !!u))];
  return { css, fontUrls };
}

/** The default theme's token values by key, for places that cannot read the theme's CSS (icons, the manifest). */
export async function tokenValues(db: Db): Promise<Map<string, string>> {
  const [theme] = await db.select().from(themes).where(eq(themes.isDefault, true));
  if (!theme) return new Map();
  const rows = await db.select().from(designTokens).where(eq(designTokens.themeId, theme.id));
  return new Map(rows.map((r) => [r.key, r.value]));
}

/** How long the install icons and manifest reuse the theme colours they last read. */
const BRAND_TOKENS_MS = 10 * 60_000;
let brandTokens: { at: number; tokens: Map<string, string> } | null = null;

/**
 * The theme colours for the install icons and manifest, which browsers fetch on their own and must never
 * fail: read from the database at most every few minutes, and from the seeded default theme when the
 * database is busy or unreachable.
 */
export async function brandTokenValues(): Promise<Map<string, string>> {
  if (brandTokens && Date.now() - brandTokens.at < BRAND_TOKENS_MS) return brandTokens.tokens;
  try {
    const tokens = await tokenValues(await getDb());
    if (tokens.size) brandTokens = { at: Date.now(), tokens };
    if (tokens.size) return tokens;
  } catch {
    // A busy pool or a lost connection: fall through to the seeded colours.
  }
  return brandTokens?.tokens ?? new Map(themeSeed.tokens.map((t) => [t.key, t.value]));
}
