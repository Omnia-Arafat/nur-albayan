import iconSeed from "../../../seed/icons.json";
import { iconSet, iconSvg, toneOf, type IconColours } from "@/modules/theme/icons";

const set = iconSet.parse(iconSeed);

/** An icon from the book's set (seed/icons.json). `tone` paints it in a pill palette (sky, peach...). */
export function Icon({
  name,
  size = 24,
  tone,
  colours,
  title,
  className,
}: {
  name: string;
  size?: number;
  tone?: string;
  colours?: IconColours;
  title?: string;
  className?: string;
}) {
  const c = {
    ...(tone ? toneOf(tone) : {}),
    ...(tone === "gray" ? { accent: "color.pill.gray.line" } : {}),
    ...colours,
  };
  return (
    <span
      className={`nb-icon${className ? ` ${className}` : ""}`}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: iconSvg(set, name, { size, colours: c, title }) }}
    />
  );
}
