/**
 * One item of the book-page source format (see scripts/book/dsl.ts for the whole page format):
 * [..] target (red), {..} contrast (blue), <..> secondary (purple), ~..~ rule (green), plain text base,
 * "/" a cell divider, " - " / " ← " / " = " separators, and the suffixes #g #s #d (card type), @colour, &picture.
 * Shared by the page builder and the admin editor, so an edited item is stored exactly as a built one.
 */
import type { ContentSegment } from "@/db/seed/content";

const TYPE_BY_SUFFIX: Record<string, string> = { g: "golden", s: "speed", d: "danger" };
const SUFFIX_BY_TYPE: Record<string, string> = { golden: "#g", speed: "#s", danger: "#d" };
const OPEN: Record<string, string> = { "[": "target", "{": "contrast", "<": "secondary", "~": "rule" };
const CLOSE: Record<string, string> = { "[": "]", "{": "}", "<": ">", "~": "~" };

export function parseItem(src: string): {
  cardType: string;
  tint?: string;
  image?: string;
  segments: ContentSegment[];
} {
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

/**
 * The book prints Qur'anic text in the Uthmani script and everything else in naskh, even side by side
 * in one table. Uthmani marks (the sukun ۡ, hamzat al-wasl ٱ, open tanween, the small meem, pause marks)
 * make an item Uthmani; the naskh round sukun ْ makes it naskh; an item with neither takes the page's script:.
 */
const UTHMANI_MARKS = /[\u0671\u06D6-\u06DC\u06E1\u06E2\u06ED\u08F0-\u08F2]/;
const NASKH_MARKS = /\u0652/;
export function scriptOf(segments: ContentSegment[], fallback: "naskh" | "uthmani"): "naskh" | "uthmani" {
  const text = segments.map((s) => s.text).join("");
  if (UTHMANI_MARKS.test(text)) return "uthmani";
  if (NASKH_MARKS.test(text)) return "naskh";
  return fallback;
}

/** Plain text without harakat, Qur'anic marks, tatweel or joiners: the item's search text. */
export const stripTashkeel = (s: string) =>
  s
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640\u200D]/g, "")
    .replace(/\s+/g, " ")
    .trim();
