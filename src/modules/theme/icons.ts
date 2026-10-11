import { z } from "zod";

import { cssVar } from "./css";

/**
 * The book's icon set (seed/icons.json). Every icon is drawn the way the book draws its letter pills: a
 * pastel shape with a darker outline of the same hue, and the red of a haraka as the one accent. Parts
 * name a role, not a colour, so one icon can take any pill palette.
 */
const role = z.enum(["fill", "line", "accent", "paper", "none"]);

export const iconSet = z.object({
  style: z
    .object({ viewBox: z.string(), lineWidth: z.number().positive() })
    .loose(),
  icons: z.array(
    z.object({
      key: z.string().regex(/^[a-z0-9-]+$/),
      label: z.record(z.string(), z.string()),
      defaults: z.object({
        fill: z.string(),
        line: z.string(),
        accent: z.string(),
      }),
      parts: z
        .array(
          z.object({
            d: z.string().regex(/^[MmLlHhVvCcSsQqTtAaZz0-9.,\s-]+$/),
            paint: role,
            stroke: role,
            width: z.number().positive().optional(),
            dash: z
              .string()
              .regex(/^[0-9.\s]+$/)
              .optional(),
          }),
        )
        .min(1),
    }),
  ),
});

export type IconSet = z.infer<typeof iconSet>;
export type IconColours = Partial<Record<"fill" | "line" | "accent", string>>;

/** Pill palette key → the fill and line tokens of that pill, so an icon can match the tile it sits on. */
export const toneOf = (palette: string): IconColours => ({
  fill: `color.pill.${palette}.fill`,
  line: `color.pill.${palette}.line`,
});

/**
 * SVG markup for one icon. Colours are token keys, written as CSS variables so the active theme decides
 * the values; `resolve` swaps that for literal values (for places that cannot read the theme's CSS).
 */
export function iconSvg(
  set: IconSet,
  key: string,
  opts: {
    size?: number;
    colours?: IconColours;
    title?: string;
    resolve?: (tokenKey: string) => string;
  } = {},
): string {
  const icon = set.icons.find((i) => i.key === key);
  if (!icon) throw new Error(`Unknown icon: ${key}`);
  const tokens = {
    ...icon.defaults,
    ...opts.colours,
    paper: "color.surface",
  } as Record<string, string>;
  const value = opts.resolve ?? ((k: string) => `var(${cssVar(k)})`);
  const paint = (r: z.infer<typeof role>) =>
    r === "none" ? "none" : value(tokens[r]);
  const size = opts.size ?? 24;
  const a11y = opts.title
    ? `role="img" aria-label="${opts.title.replace(/[<>&"]/g, "")}"`
    : `aria-hidden="true"`;
  const parts = icon.parts
    .map(
      (p) =>
        `<path d="${p.d}" fill="${paint(p.paint)}" stroke="${paint(p.stroke)}" stroke-width="${p.width ?? set.style.lineWidth}"${p.dash ? ` stroke-dasharray="${p.dash}"` : ""}/>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${set.style.viewBox}" stroke-linecap="round" stroke-linejoin="round" ${a11y}>${parts}</svg>`;
}
