import { readFileSync } from "node:fs";
import { join } from "node:path";

import { z } from "zod";

import { scoringRules } from "@/modules/scoring/profile";

const i18n = <T extends z.ZodRawShape>(shape: T) => z.record(z.string(), z.object(shape));
const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

export const seedSchemas = {
  locales: z.array(
    z.object({
      code: z.string().min(2),
      name: z.string(),
      dir: z.enum(["rtl", "ltr"]),
      numberingSystem: z.string(),
      isDefault: z.boolean(),
      enabled: z.boolean(),
      position: z.number().int(),
    }),
  ),
  theme: z.object({
    theme: z.object({ slug: z.string(), name: z.string(), mode: z.enum(["light", "dark"]), isDefault: z.boolean() }),
    tokens: z.array(
      z
        .object({
          group: z.enum(["color", "font", "font_size", "font_weight", "radius", "space", "shadow", "motion", "border"]),
          key: z.string().regex(/^[a-z_]+(\.[a-z0-9_]+)+$/),
          value: z.string().min(1),
          description: z.string().optional(),
        })
        .refine((t) => t.group !== "color" || hex.safeParse(t.value).success, "color tokens must be #RRGGBB"),
    ),
  }),
  fonts: z.array(
    z.object({
      role: z.enum(["display", "naskh", "quran", "ui"]),
      family: z.string(),
      fallbacks: z.string(),
      cssUrl: z.url().optional(),
      assetPath: z.string().optional(),
      weights: z.array(z.number().int()),
      isDefault: z.boolean(),
    }),
  ),
  semanticRoles: z.array(
    z.object({
      key: z.string(),
      tokenKey: z.string(),
      position: z.number().int(),
      i18n: i18n({ label: z.string(), description: z.string().optional() }),
    }),
  ),
  pillPalettes: z.array(
    z.object({
      slug: z.string(),
      fillTokenKeys: z.array(z.string()).min(1),
      rowsPerColor: z.number().int().min(1),
      isDefault: z.boolean(),
    }),
  ),
  cardTypes: z.array(
    z.object({
      key: z.string(),
      iconKey: z.string(),
      frameTokenKey: z.string(),
      position: z.number().int(),
      i18n: i18n({ label: z.string() }),
    }),
  ),
  scoringProfile: z.object({
    slug: z.string(),
    version: z.number().int().min(1),
    isDefault: z.boolean(),
    rules: scoringRules,
  }),
  games: z.array(
    z.object({
      key: z.string(),
      kind: z.enum(["break", "wordwall"]),
      position: z.number().int(),
      iconKey: z.string(),
      fillTokenKey: z.string(),
      enabled: z.boolean(),
      defaultConfig: z.record(z.string(), z.unknown()),
      i18n: i18n({ name: z.string(), description: z.string().optional() }),
    }),
  ),
  feedbackMessages: z.array(
    z.object({ kind: z.string(), locale: z.string(), text: z.string(), weight: z.number().int().min(1) }),
  ),
  roles: z.object({
    roles: z.array(z.object({ key: z.string(), position: z.number().int(), i18n: i18n({ label: z.string() }) })),
    permissions: z.array(z.object({ key: z.string(), i18n: i18n({ description: z.string() }) })),
    rolePermissions: z.record(z.string(), z.array(z.string())),
  }),
  avatars: z.object({
    avatars: z.array(z.object({ kind: z.enum(["emoji", "asset"]), value: z.string(), position: z.number().int() })),
    colors: z.array(z.object({ tokenKey: z.string(), position: z.number().int() })),
  }),
  levels: z.array(
    z.object({
      key: z.string(),
      position: z.number().int(),
      xpThreshold: z.number().int().min(0),
      iconKey: z.string(),
      i18n: i18n({ name: z.string() }),
    }),
  ),
  badges: z.array(
    z.object({
      key: z.string(),
      criteria: z.object({ type: z.string(), count: z.number().int().min(1) }).loose(),
      iconKey: z.string(),
      fillTokenKey: z.string(),
      position: z.number().int(),
      i18n: i18n({ name: z.string(), description: z.string() }),
    }),
  ),
  settings: z.array(
    z.object({
      key: z.string(),
      type: z.enum(["boolean", "integer", "enum", "string", "json"]),
      defaultValue: z.unknown(),
      group: z.string(),
      allowedScopes: z.array(z.enum(["platform", "classroom", "teacher", "student", "device"])).min(1),
      position: z.number().int(),
      options: z.array(z.string()).optional(),
      min: z.number().int().optional(),
      max: z.number().int().optional(),
      step: z.number().int().optional(),
    }),
  ),
  uiMessages: z.record(z.string(), z.record(z.string(), z.string())),
} as const;

const files = {
  locales: "locales.json",
  theme: "theme.book-light.json",
  fonts: "fonts.json",
  semanticRoles: "semantic-roles.json",
  pillPalettes: "pill-palettes.json",
  cardTypes: "card-types.json",
  scoringProfile: "scoring-profile.default.json",
  games: "games.json",
  feedbackMessages: "feedback-messages.json",
  roles: "roles.json",
  avatars: "avatars.json",
  levels: "levels.json",
  badges: "badges.json",
  settings: "settings.json",
} as const satisfies Record<Exclude<keyof typeof seedSchemas, "uiMessages">, string>;

export type SeedData = { [K in keyof typeof files]: z.infer<(typeof seedSchemas)[K]> } & {
  uiMessages: Record<string, z.infer<typeof seedSchemas.uiMessages>>;
};

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));

/** Read and validate every seed file. Throws with the file name on the first invalid one. */
export function loadSeed(dir = join(process.cwd(), "seed")): SeedData {
  const out: Record<string, unknown> = {};
  for (const [name, file] of Object.entries(files)) {
    const parsed = seedSchemas[name as keyof typeof files].safeParse(readJson(join(dir, file)));
    if (!parsed.success) throw new Error(`seed/${file}: ${z.prettifyError(parsed.error)}`);
    out[name] = parsed.data;
  }
  const locales = out.locales as SeedData["locales"];
  out.uiMessages = Object.fromEntries(
    locales.map((l) => [l.code, seedSchemas.uiMessages.parse(readJson(join(dir, "ui-messages", `${l.code}.json`)))]),
  );
  return out as SeedData;
}
