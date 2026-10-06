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
 * Header keys stage: and topic: carry over to the following pages until changed.
 */
import type { ContentLesson, ContentSegment } from "../../src/db/seed/content";

const TYPE_BY_SUFFIX: Record<string, string> = { g: "golden", s: "speed", d: "danger" };
const SUFFIX_BY_TYPE: Record<string, string> = { golden: "#g", speed: "#s", danger: "#d" };
const OPEN: Record<string, string> = { "[": "target", "{": "contrast", "<": "secondary", "~": "rule" };
const CLOSE: Record<string, string> = { "[": "]", "{": "}", "<": ">", "~": "~" };

export function parseItem(src: string): { cardType: string; tint?: string; image?: string; segments: ContentSegment[] } {
  let text = src.trim();
  let cardType = "normal";
  let tint: string | undefined;
  let image: string | undefined;
  for (;;) {
    const m = text.match(/(?:#([gsd])|@([a-z]+)|&([a-z0-9-]+))$/);
    if (!m) break;
    if (m[1]) cardType = TYPE_BY_SUFFIX[m[1]];
    else if (m[2]) tint = m[2];
    else image = m[3];
    text = text.slice(0, -m[0].length).trim();
  }
  const segments: ContentSegment[] = [];
  const push = (t: string, role: string) => {
    if (!t) return;
    // " - " between variants and " ← " between a word and its madd form are separator segments.
    t.split(/( - | ← | = )/).forEach((part) => {
      if (!part) return;
      if (part === " - " || part === " ← " || part === " = ") segments.push({ text: part, role: "separator" });
      else segments.push({ text: part, role });
    });
  };
  let i = 0;
  let buf = "";
  while (i < text.length) {
    const ch = text[i];
    if (ch === "/") {
      push(buf, "base");
      buf = "";
      if (!segments.length) throw new Error(`cell divider at start: ${src}`);
      segments[segments.length - 1].cellBreakAfter = true;
      i++;
    } else if (OPEN[ch]) {
      push(buf, "base");
      buf = "";
      const end = text.indexOf(CLOSE[ch], i + 1);
      if (end < 0) throw new Error(`unclosed ${ch} in: ${src}`);
      const inner = text.slice(i + 1, end);
      // A divider may sit inside a coloured run: [بَـ/ـبَ]
      inner.split("/").forEach((part, j, all) => {
        push(part, OPEN[ch]);
        if (j < all.length - 1) segments[segments.length - 1].cellBreakAfter = true;
      });
      i = end + 1;
    } else {
      buf += ch;
      i++;
    }
  }
  push(buf, "base");
  if (!segments.length) throw new Error(`empty item: ${src}`);
  return { cardType, ...(tint ? { tint } : {}), ...(image ? { image } : {}), segments };
}

export function formatItem(cardType: string, segments: ContentSegment[]): string {
  const open: Record<string, [string, string]> = {
    target: ["[", "]"],
    contrast: ["{", "}"],
    secondary: ["<", ">"],
    rule: ["~", "~"],
  };
  const body = segments
    .map((s) => {
      const t = s.role in open ? `${open[s.role][0]}${s.text}${open[s.role][1]}` : s.text;
      return t + (s.cellBreakAfter ? "/" : "");
    })
    .join("");
  return body + (SUFFIX_BY_TYPE[cardType] ?? "");
}

const stripTashkeel = (s: string) =>
  s.replace(/[ً-ٰٟۖ-ۭـ‍]/g, "").replace(/\s+/g, " ").trim();

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
        script: head.script === "uthmani" ? "uthmani" : "naskh",
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
