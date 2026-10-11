import { joinRuns } from "@/modules/book/joining";
import { cssVar } from "@/modules/theme/css";

export type Run = { text: string; role: string };

/**
 * A word as the book prints it, each segment in its teaching colour. All runs sit inside one inline span:
 * runs that are separate flex or grid children are shaped one by one and the letters stop joining.
 */
export function Word({ segments, colours = true }: { segments: Run[]; colours?: boolean }) {
  const texts = joinRuns(segments.map((s) => s.text));
  return (
    <span className="nb-runs" lang="ar">
      {segments.map((s, i) => (
        <span key={i} style={colours ? { color: `var(--nb-role-${s.role})` } : undefined}>
          {texts[i]}
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
  ...rest
}: {
  segments: Run[];
  palette: string;
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
      <Word segments={segments} />
    </Tag>
  );
}
