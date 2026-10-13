import { and, eq } from "drizzle-orm";

import motionSeed from "../../../seed/motion.json";
import iconSeed from "../../../seed/icons.json";
import type { Db } from "@/db/client";
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
