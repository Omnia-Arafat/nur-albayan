import { Pill, pillVars, Word } from "@/components/book/word";
import type { Item, Section } from "@/modules/content/service";

/** Pill colour of an item: the section's row colours by row band, else column colours, else the palette cycle. */
export function paletteOf(section: Section, item: Item, index: number, fallback: string[]): string {
  const cfg = section.config as { rowColors?: string[]; columnColors?: string[]; columns?: number };
  if (cfg.rowColors?.length) return cfg.rowColors[Math.min(item.rowBand, cfg.rowColors.length - 1)];
  if (cfg.columnColors?.length)
    return cfg.columnColors[index % (cfg.columns ?? cfg.columnColors.length)] ?? cfg.columnColors[0];
  const band = Math.floor(item.rowBand / Math.max(1, section.rowsPerColor));
  const fills = section.paletteFills.length ? section.paletteFills.map((k) => k.split(".").pop()!) : fallback;
  return fills[band % fills.length];
}

/** Teacher-note text: [..] is the part the book prints in red and bold. */
export function NoteText({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/(\[[^\]]*\])/)
        .map((part, i) => (part.startsWith("[") ? <b key={i}>{part.slice(1, -1)}</b> : <span key={i}>{part}</span>))}
    </>
  );
}

/** One section of the printed page, drawn with the book's components by kind. */
export function SectionView({ section, palette }: { section: Section; palette: string[] }) {
  const cfg = section.config as { columns?: number; markColor?: string };
  const cols = Math.max(1, cfg.columns ?? 4);
  const kind = section.kind;
  const label = section.label || section.title;
  if (kind === "rule_definition" || kind === "story") {
    return (
      <div className={kind === "story" ? "nb-story" : "nb-rule"}>
        {label && <h3 className="nb-section-label">{label}</h3>}
        {section.items.map((it) => (
          <p
            key={it.id}
            className="nb-rule-line"
            style={{ fontFamily: it.script === "uthmani" ? "var(--nb-font-quran)" : "var(--nb-font-naskh)" }}
          >
            <Word segments={it.segments} marks={cfg.markColor} tint={it.tint ?? undefined} />
          </p>
        ))}
      </div>
    );
  }
  const variant = kind === "letter_tiles" ? "tiles" : kind === "sentences" || kind === "rule_table" ? "lines" : "words";
  return (
    <div className="nb-section">
      {label && <h3 className="nb-section-label">{label}</h3>}
      <div className={`nb-word-grid nb-word-grid-${variant}`} style={{ "--cols": cols } as React.CSSProperties}>
        {section.items.map((it, i) => (
          <Pill
            key={it.id}
            segments={it.segments}
            palette={paletteOf(section, it, i, palette)}
            script={it.script}
            marks={cfg.markColor}
            tint={it.tint ?? undefined}
            className={variant === "tiles" ? "nb-pill-tile" : variant === "lines" ? "nb-pill-line" : ""}
          />
        ))}
      </div>
    </div>
  );
}

export const sectionStyle = (p: string) => pillVars(p);
