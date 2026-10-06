import { describe, expect, it } from "vitest";

import { loadSeed } from "@/db/seed/files";

import { compileThemeCss, cssVar } from "./css";

describe("compileThemeCss", () => {
  const seed = loadSeed();
  const css = compileThemeCss(
    seed.theme.tokens,
    seed.fonts.filter((f) => f.isDefault),
    seed.semanticRoles,
  );

  it("emits one variable per token and points roles at tokens", () => {
    expect(cssVar("color.pill.yellow.fill")).toBe("--nb-color-pill-yellow-fill");
    expect(css).toContain("--nb-color-paper:#FEFBDA");
    expect(css).toContain("--nb-role-target:var(--nb-color-red)");
    expect(css).toContain("--nb-font-naskh:'Noto Naskh Arabic', 'Amiri', serif");
  });

  it("refuses values that could break out of the rule", () => {
    expect(() => compileThemeCss([{ key: "color.x", value: "red;}body{" }], [], [])).toThrow();
  });
});
