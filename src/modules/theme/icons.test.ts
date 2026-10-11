import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { iconSet, iconSvg, toneOf } from "./icons";

const set = iconSet.parse(JSON.parse(readFileSync(join(process.cwd(), "seed/icons.json"), "utf8")));
const tokens = new Set(
  (JSON.parse(readFileSync(join(process.cwd(), "seed/theme.book-light.json"), "utf8")).tokens as { key: string }[]).map(
    (t) => t.key,
  ),
);
const iconKeysInSeed = [
  ...["badges.json", "games.json", "card-types.json", "levels.json"].flatMap((f) =>
    (
      JSON.parse(readFileSync(join(process.cwd(), "seed", f), "utf8")) as {
        iconKey: string;
      }[]
    ).map((r) => r.iconKey),
  ),
  ...(
    JSON.parse(readFileSync(join(process.cwd(), "seed/avatars.json"), "utf8")).avatars as {
      kind: string;
      value: string;
    }[]
  )
    .filter((a) => a.kind === "icon")
    .map((a) => a.value),
];

describe("book icon set", () => {
  it("draws every icon the seed data names", () => {
    const keys = new Set(set.icons.map((i) => i.key));
    expect(iconKeysInSeed.filter((k) => !keys.has(k))).toEqual([]);
  });

  it("only uses colours from the theme", () => {
    const used = set.icons.flatMap((i) => Object.values(i.defaults));
    expect(used.filter((k) => !tokens.has(k))).toEqual([]);
  });

  it("writes theme variables, and takes a pill palette", () => {
    const svg = iconSvg(set, "lock", { colours: toneOf("sky") });
    expect(svg).toContain("var(--nb-color-pill-sky-fill)");
    expect(svg).toContain('aria-hidden="true"');
    expect(iconSvg(set, "star", { resolve: () => "#000", title: "نجمة" })).toContain('aria-label="نجمة"');
  });
});
