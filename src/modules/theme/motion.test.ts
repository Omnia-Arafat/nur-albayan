import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { compileMotionCss, motionSet } from "./motion";

const read = (f: string) => JSON.parse(readFileSync(join(process.cwd(), "seed", f), "utf8"));
const set = motionSet.parse(read("motion.json"));
const tokens = new Set((read("theme.book-light.json").tokens as { key: string }[]).map((t) => t.key));

describe("motion system", () => {
  it("only times motion with theme tokens", () => {
    const used = [...set.animations, ...set.transitions].flatMap((m) => [m.duration, m.easing]);
    expect(used.filter((k) => !tokens.has(k))).toEqual([]);
  });

  it("writes a class per motion and stops loops for reduced motion", () => {
    const css = compileMotionCss(set);
    expect(css).toContain("@keyframes nb-pop{");
    expect(css).toContain(
      ".nb-anim-pop{animation:nb-pop var(--nb-motion-normal) var(--nb-easing-bounce) 1 normal both}",
    );
    expect(css).toContain(".nb-tr-press{transition:transform var(--nb-motion-fast)");
    const reduced = css.slice(css.indexOf("prefers-reduced-motion"));
    expect(reduced).toContain(".nb-anim-pulse{animation:none}");
    expect(reduced).toContain(".nb-anim-pop{animation-name:nb-pop-reduced}");
  });
});
