import { z } from "zod";

import { cssVar } from "./css";

/**
 * The motion system (seed/motion.json): every animation and transition the app uses, as data. Timing
 * comes from theme tokens, so components never write their own durations or curves; they add the class
 * for a named motion (nb-anim-pop, nb-tr-press). Reduced motion keeps only a fade for entrances and
 * stops every loop.
 */
const declarations = z.string().regex(/^[^{}<>]+$/);
const frames = z.record(z.string().regex(/^(\d{1,3}%|from|to)$/), declarations);

export const motionSet = z.object({
  animations: z.array(
    z.object({
      key: z.string().regex(/^[a-z0-9-]+$/),
      use: z.string(),
      duration: z.string(),
      easing: z.string(),
      iterations: z.union([z.literal("infinite"), z.string().regex(/^\d+$/)]),
      fill: z.enum(["none", "both", "forwards", "backwards"]),
      direction: z.enum(["normal", "alternate"]).optional(),
      origin: declarations.optional(),
      frames,
      reduced: frames.optional(),
    }),
  ),
  transitions: z.array(
    z.object({
      key: z.string().regex(/^[a-z0-9-]+$/),
      use: z.string(),
      properties: z.string().regex(/^[a-z-]+(,\s*[a-z-]+)*$/),
      duration: z.string(),
      easing: z.string(),
    }),
  ),
});

export type MotionSet = z.infer<typeof motionSet>;

const keyframes = (name: string, f: Record<string, string>) =>
  `@keyframes ${name}{${Object.entries(f)
    .map(([at, d]) => `${at}{${d}}`)
    .join("")}}`;

/** CSS for the whole motion system: keyframes, one class per animation and transition, reduced-motion rules. */
export function compileMotionCss(set: MotionSet, value: (tokenKey: string) => string = (k) => `var(${cssVar(k)})`) {
  const out: string[] = [];
  const reduced: string[] = [];
  for (const a of set.animations) {
    const name = `nb-${a.key}`;
    out.push(keyframes(name, a.frames));
    const timing = `${value(a.duration)} ${value(a.easing)} ${a.iterations} ${a.direction ?? "normal"} ${a.fill}`;
    out.push(`.nb-anim-${a.key}{animation:${name} ${timing}${a.origin ? `;transform-origin:${a.origin}` : ""}}`);
    if (a.reduced) {
      out.push(keyframes(`${name}-reduced`, a.reduced));
      reduced.push(`.nb-anim-${a.key}{animation-name:${name}-reduced}`);
    } else reduced.push(`.nb-anim-${a.key}{animation:none}`);
  }
  for (const t of set.transitions) {
    const props = t.properties.split(/,\s*/);
    out.push(
      `.nb-tr-${t.key}{transition:${props.map((p) => `${p} ${value(t.duration)} ${value(t.easing)}`).join(",")}}`,
    );
    reduced.push(`.nb-tr-${t.key}{transition-duration:0s}`);
  }
  out.push(`@media (prefers-reduced-motion: reduce){${reduced.join("")}}`);
  return out.join("\n");
}
