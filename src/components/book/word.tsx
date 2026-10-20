import { joinRuns } from "@/modules/book/joining";
import { cssVar } from "@/modules/theme/css";

export type Run = { text: string; role: string };

/** Harakat, tanween, shadda, sukun and the Qur'anic small marks: everything drawn over or under a letter. */
const MARKS = /([\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED\u08D3-\u08FF]+)/;

/**
 * A word as the book prints it, each segment in its teaching colour. All runs sit inside one inline span:
 * runs that are separate flex or grid children are shaped one by one and the letters stop joining.
 * `marks` draws every haraka in one book colour (the pages that print black letters with red harakat);
 * `tint` is the book's decorative colour for the plain letters (the alphabet tiles).
 */
export function Word({
  segments,
  colours = true,
  marks,
  tint,
}: {
  segments: Run[];
  colours?: boolean;
  marks?: string;
  tint?: string;
}) {
  const texts = joinRuns(segments.map((s) => s.text));
  const colourOf = (role: string) =>
    !colours ? undefined : role === "base" && tint ? tokenVar(`color.${tint}`) : `var(--nb-role-${role})`;
  return (
    <span className="nb-runs" lang="ar">
      {segments.map((s, i) => (
        <span key={i} style={colours ? { color: colourOf(s.role) } : undefined}>
          {colours && marks
            ? texts[i]
                .split(MARKS)
                .map((part, j) =>
                  j % 2 ? (
                    <span key={j} style={{ color: tokenVar(`color.${marks}`) }}>
                      {part}
                    </span>
                  ) : (
                    part
                  ),
                )
            : texts[i]}
        </span>
      ))}
    </span>
  );
}

/** Fill and line variables of a pill palette (peach, sky...), for --fill / --line. */
export const pillVars = (palette: string) =>
  ({
    "--fill": `var(${cssVar(`color.pill.${palette}.fill`)})`,
    "--line": `var(${cssVar(`color.pill.${palette}.line`)})`,
  }) as React.CSSProperties;

export const tokenVar = (key: string) => `var(${cssVar(key)})`;

/** The book's word pill. */
export function Pill({
  segments,
  palette,
  size,
  script = "naskh",
  as = "span",
  className = "",
  marks,
  tint,
  ...rest
}: {
  segments: Run[];
  palette: string;
  marks?: string;
  tint?: string;
  size?: number;
  script?: "naskh" | "uthmani";
  as?: "span" | "button";
  className?: string;
} & React.HTMLAttributes<HTMLElement>) {
  const Tag = as;
  const style = {
    ...pillVars(palette),
    ...(size ? { "--size": `${size}px` } : {}),
    fontFamily: script === "uthmani" ? "var(--nb-font-quran)" : undefined,
    ...rest.style,
  } as React.CSSProperties;
  return (
    <Tag
      {...rest}
      {...(as === "button" ? { type: "button" as const } : {})}
      className={`nb-pill${as === "button" ? " nb-tr-press" : ""} ${className}`}
      aria-label={rest["aria-label"] ?? segments.map((s) => s.text).join("")}
      style={style}
    >
      <Word segments={segments} marks={marks} tint={tint} />
    </Tag>
  );
}
