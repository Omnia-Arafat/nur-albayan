/**
 * The book-page source format (seed/book/NNN.txt), written by hand from the scan.
 *
 *   page: 29
 *   unit: الوحدة الثانية          (only where the book prints it)
 *   lesson: الدرس الثاني
 *   observe: اقرأ ولاحظ
 *   title: المد بالياء
 *   subtitle: تدريب (٢) أمثلة قرآنية
 *   note: للمعلم والآباء: ...
 *   ## word_rows cols=5 colors=salmon,salmon,sky,sky label=تدريب (١)
 *   أَخِ[ى] ; أَبِـ[ى]#g ; ...       one book row per line, items separated by " ; "
 *
 * Inside an item: [..] target (red), {..} contrast (blue), <..> secondary (purple),
 * ~..~ rule (green), plain text base (black), "/" a cell divider, " - " the dash between
 * compared variants, " ← " the arrow from a word to its lengthened form, " = " an equals sign. A line that is one long text (a paragraph) uses no " ; ".
 * Section options: cols=N, colors=pill,pill,... (one per row), label=..., frame=..., drill=no,
 * colcolors=pill,pill,... (one per column, where the book colours by column),
 * marks=<colour> (the harakat drawn in that colour, as on the review pages)
 * (read but not drilled). A suffix #g, #s or #d sets the card type (golden, speed, danger),
 * the game layer on top of the book; no suffix is normal. A suffix @purple (any colour name)
 * gives the item the book's decorative colour, e.g. the alphabet tiles: color.<name>.
 * A suffix &slug attaches the picture book/images/<slug>.webp (picture-word cards).
 * Header keys stage: and topic: carry over to the following pages until changed. script: uthmani sets
 * the page's default; each item still follows its own marks (see scriptOf).
 */
import type { ContentLesson } from "../../src/db/seed/content";
import { parseItem, scriptOf, stripTashkeel } from "../../src/modules/book/item-dsl";

export { formatItem, parseItem } from "../../src/modules/book/item-dsl";

type Section = ContentLesson["sections"][number];

export function parsePage(src: string, stageOf: (page: number) => { stage: string; topic: string }): ContentLesson {
  const head: Record<string, string> = {};
  type Draft = Section & { cols: number; drill: boolean };
  const sections: Draft[] = [];
  let current: Draft | null = null;
  let row = 0;
  for (const raw of src.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("//")) continue;
    if (line.startsWith("## ")) {
      const [kind, ...opts] = line.slice(3).split(/\s+(?=\w+=)/);
      const cfg: Record<string, string> = {};
      for (const o of opts) {
        const eq = o.indexOf("=");
        cfg[o.slice(0, eq)] = o.slice(eq + 1);
      }
      current = {
        kind: kind.trim() as Section["kind"],
        cols: Number(cfg.cols ?? 1),
        config: {
          columns: Number(cfg.cols ?? 1),
          ...(cfg.colors ? { rowColors: cfg.colors.split(",") } : {}),
          ...(cfg.label ? { label: cfg.label } : {}),
          ...(cfg.frame ? { frame: cfg.frame } : {}),
          ...(cfg.strip ? { stripColors: cfg.strip.split(",") } : {}),
          ...(cfg.tints ? { tintCycle: cfg.tints.split(",") } : {}),
          ...(cfg.marks ? { markColor: cfg.marks } : {}),
          ...(cfg.colcolors ? { columnColors: cfg.colcolors.split(",") } : {}),
        },
        drill: cfg.drill !== "no",
        items: [],
      };
      sections.push(current);
      row = 0;
      continue;
    }
    const kv = line.match(/^([a-z]+):\s*(.*)$/);
    if (kv && !current) {
      head[kv[1]] = kv[2];
      continue;
    }
    if (!current) throw new Error(`content before the first section: ${line}`);
    for (const item of line.split(" ; ")) {
      const { cardType, tint, image, segments } = parseItem(item);
      current.items.push({
        cardType,
        ...(tint ? { tint } : {}),
        ...(image ? { image } : {}),
        script: scriptOf(segments, head.script === "uthmani" ? "uthmani" : "naskh"),
        rowBand: row,
        ...(current.drill ? {} : { drillable: false }),
        searchText: stripTashkeel(segments.map((s) => s.text).join("")),
        segments,
      });
    }
    row++;
  }
  const page = Number(head.page);
  if (!page) throw new Error("missing page:");
  return {
    slug: `page-${page}`,
    bookPage: page,
    stage: head.stage ?? stageOf(page).stage,
    topic: head.topic ?? stageOf(page).topic,
    status: "review",
    i18n: {
      ar: {
        title: head.title,
        ...(head.subtitle ? { subtitle: head.subtitle } : {}),
        ...(head.note ? { teacherNote: head.note } : {}),
        ...(head.unit ? { unitTag: head.unit } : {}),
        ...(head.lesson ? { lessonTag: head.lesson } : {}),
        ...(head.observe ? { observeTag: head.observe } : {}),
      },
    },
    sections: sections.map(({ cols: _cols, drill: _drill, ...s }) => s),
    rules: [],
    games: {},
    source: `book page ${page}`,
  };
}
