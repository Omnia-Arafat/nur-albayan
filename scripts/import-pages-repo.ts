/**
 * One-time importer: turns the lesson pages of nur-albayan-pages into content seed files.
 *
 *   pnpm import:pages ../nur-albayan-pages
 *
 * Reads pages/<n>.html (PAGE_CONFIG + dataset), rules/{ar,en}.json and index.html (stages),
 * and writes seed/content/book.json, seed/content/pages/<n>.json and seed/content/IMPORT_REPORT.md.
 * Every lesson is imported as a draft for review against the printed book.
 * Pages whose script is not the standard `dataset` list are listed in the report for manual entry.
 */
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";

import type { ContentBook, ContentLesson, ContentSegment, RuleExamplePart } from "../src/db/seed/content";

const repo = process.argv[2];
if (!repo) throw new Error("Usage: pnpm import:pages <path to nur-albayan-pages>");
const out = join(process.cwd(), "seed", "content");

// Colour classes of the pages repo → teaching roles (see seed/semantic-roles.json).
const ROLE_BY_CLASS: Record<string, string> = {
  "c-red": "target",
  "c-blue": "contrast",
  "c-darkblue": "contrast",
  "c-black": "base",
  "c-purple": "secondary",
  "c-amber": "secondary",
  "c-emerald": "rule",
  // Positional colours used by the segmented drills (same palette as red, blue, black).
  c0: "target",
  c1: "contrast",
  c2: "base",
};
// Pill themes of the pages repo → band index in the default pill palette (yellow, sky, pink, lime).
const BAND_BY_THEME: Record<string, number> = { yellow: 0, blue: 1, pink: 2, green: 3 };
const POSITION_ROLES = ["target", "contrast", "base"];
const CARD_TYPES = new Set(["normal", "golden", "speed", "danger"]);

const roleOf = (cls: string) => cls.split(/\s+/).map((c) => ROLE_BY_CLASS[c]).find(Boolean);

const report: string[] = [];
const warn = (page: string, msg: string) => report.push(`- page ${page}: ${msg}`);

const decode = (s: string) =>
  s
    .replace(/&zwj;/g, "‍")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

/** Split the pages repo's span markup into role-tagged segments. */
function toSegments(html: string, page: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  // A coloured span, any other tag (skipped), or loose text.
  const re = /<span class=['"]([^'"]+)['"]>([\s\S]*?)<\/span>|<[^>]+>|([^<]+)/g;
  for (const m of html.matchAll(re)) {
    const [, cls, inner, loose] = m;
    if (cls === undefined && loose === undefined) continue;
    if (loose !== undefined) {
      const text = decode(loose);
      if (text.trim() === "" && segments.length) segments[segments.length - 1].text += text;
      else if (text) segments.push({ text, role: "base" });
      continue;
    }
    if (cls === "sep-bar") {
      const text = decode(inner).trim();
      if (text === "|" && segments.length) segments[segments.length - 1].cellBreakAfter = true;
      else segments.push({ text: ` ${text} `, role: "separator" });
      continue;
    }
    const role = roleOf(cls);
    if (!role) warn(page, `unknown class "${cls}" read as base`);
    segments.push({ text: decode(inner.replace(/<[^>]+>/g, "")), role: role ?? "base" });
  }
  return segments;
}

/** Rule examples mix coloured letters with styled operators (+ = • ←). */
function toRuleExample(html: string, page: string): RuleExamplePart[] {
  const ops: Record<string, RuleExamplePart["op"]> = { "+": "plus", "=": "equals", "•": "dot", "←": "arrow", "-": "dash", "⟷": "compare" };
  const parts: RuleExamplePart[] = [];
  for (const m of html.matchAll(/<span class=['"]([^'"]+)['"]>([\s\S]*?)<\/span>/g)) {
    const [, cls, inner] = m;
    const text = decode(inner).trim();
    const role = roleOf(cls);
    if (ops[text]) parts.push({ op: ops[text] });
    else if (role) parts.push({ text, role });
    // The pages repo styles labels inside rule examples ("[قرآني]") like its operators.
    else if (/text-emerald/.test(cls)) parts.push({ text, role: "rule" });
    else warn(page, `rule example part "${text}" (${cls}) skipped`);
  }
  return parts;
}

const stripTashkeel = (s: string) =>
  s.replace(/[ً-ٰٟۖ-ۭـ‍]/g, "").replace(/\s+/g, " ").trim();

/** End of the statement starting at `from`: the first `;` outside brackets, strings and templates. */
function statementEnd(src: string, from: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = from; i < src.length; i++) {
    const ch = src[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") quote = ch;
    else if ("([{".includes(ch)) depth++;
    else if (")]}".includes(ch)) depth--;
    else if (ch === ";" && depth === 0) return i + 1;
  }
  return -1;
}

/**
 * Run the page's inline script up to the end of `const dataset = ...;` in an empty sandbox
 * and read back PAGE_CONFIG and dataset. This covers both literal lists and pages that build
 * the list from smaller arrays.
 */
function readPage(file: string): { config: Record<string, unknown>; dataset: unknown[] } | null {
  const html = readFileSync(file, "utf8");
  const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).find((b) => b.includes("PAGE_CONFIG"));
  if (!script) return null;
  const start = script.indexOf("const dataset");
  if (start < 0) return null;
  const end = statementEnd(script, start);
  if (end < 0) return null;
  const sandbox: Record<string, unknown> = { window: {} };
  vm.runInNewContext(`${script.slice(0, end)}\n;globalThis.__dataset = dataset;`, sandbox, { timeout: 1000 });
  const config = (sandbox.window as Record<string, unknown>).PAGE_CONFIG as Record<string, unknown> | undefined;
  if (!config || !Array.isArray(sandbox.__dataset)) return null;
  return { config, dataset: sandbox.__dataset };
}

// Stages from index.html, with English names from the locale file.
const index = readFileSync(join(repo, "index.html"), "utf8");
const en = JSON.parse(readFileSync(join(repo, "locales", "en.json"), "utf8")).strings as Record<string, string>;
const parts = index.split(/<li class="stage-heading"><h2 data-i18n="([a-z_]+)">([^<]+)<\/h2><\/li>/);
const stageOfPage = new Map<number, string>();
const book: ContentBook = {
  slug: "nur-albayan",
  edition: "5",
  i18n: { ar: { title: "نور البيان", subtitle: "لتعليم القراءة وترتيل القرآن" }, en: { title: "Nur Al-Bayan", subtitle: "Learning to read and recite the Quran" } },
  stages: [],
};
for (let i = 1; i < parts.length; i += 3) {
  const [key, arName, body] = [parts[i], parts[i + 1], parts[i + 2]];
  const pages = [...body.matchAll(/href="pages\/(\d+)\.html"/g)].map((m) => Number(m[1]));
  if (!pages.length) continue;
  const slug = key.replace(/^stage_/, "").replace(/_/g, "-");
  book.stages.push({ slug, position: book.stages.length, i18n: { ar: { title: arName }, en: { title: en[key] ?? arName } } });
  for (const p of pages) stageOfPage.set(p, slug);
}

const rulesAr = JSON.parse(readFileSync(join(repo, "rules", "ar.json"), "utf8"));
const rulesEn = JSON.parse(readFileSync(join(repo, "rules", "en.json"), "utf8"));

rmSync(join(out, "pages"), { recursive: true, force: true });
mkdirSync(join(out, "pages"), { recursive: true });

const files = readdirSync(join(repo, "pages")).filter((f) => /^\d+\.html$/.test(f));
const manual: number[] = [];
let itemCount = 0;

for (const f of files.sort((a, b) => parseInt(a) - parseInt(b))) {
  const pageNo = parseInt(f);
  const parsed = readPage(join(repo, "pages", f));
  if (!parsed) {
    manual.push(pageNo);
    continue;
  }
  const { config, dataset } = parsed;
  const [title, subtitle] = String(config.subtitle ?? "").split(/\s+—\s+/);
  const pageScript = config.fontType === "quran" ? "uthmani" : "naskh";

  let segmented = false;
  const items = dataset.flatMap((raw, i) => {
    const d = raw as { w?: string | string[]; segs?: string[]; multiBox?: boolean; t?: string; theme?: string; fontType?: string };
    // `segs` or `w` as a list: a word in parts, coloured by position (red, blue, black) like the
    // pages repo renders them. `segs` and `multiBox` draw one cell per part (segmented pill).
    const split = Array.isArray(d?.segs) ? d.segs : Array.isArray(d?.w) ? d.w : null;
    const cells = Array.isArray(d?.segs) || Boolean(d?.multiBox);
    if (cells) segmented = true;
    if (typeof d?.w !== "string" && !split) {
      warn(String(pageNo), `dataset entry ${i} has no word, skipped`);
      return [];
    }
    if (!CARD_TYPES.has(d.t ?? "")) warn(String(pageNo), `entry ${i} card type "${d.t}" read as normal`);
    const segments: ContentSegment[] = split
      ? split.map((text, j, all) => ({
          text: decode(text),
          role: POSITION_ROLES[j % POSITION_ROLES.length],
          ...(cells && j < all.length - 1 ? { cellBreakAfter: true } : {}),
        }))
      : toSegments(d.w as string, String(pageNo));
    return [
      {
        cardType: CARD_TYPES.has(d.t ?? "") ? (d.t as string) : "normal",
        script: d.fontType ? (d.fontType === "quran" ? "uthmani" : "naskh") : pageScript,
        rowBand: BAND_BY_THEME[d.theme ?? ""] ?? 0,
        searchText: stripTashkeel(segments.map((s) => s.text).join("")),
        segments,
      } as ContentLesson["sections"][number]["items"][number],
    ];
  });
  itemCount += items.length;

  const lesson: ContentLesson = {
    slug: `page-${pageNo}`,
    bookPage: pageNo,
    stage: stageOfPage.get(pageNo) ?? book.stages[book.stages.length - 1].slug,
    status: "draft",
    i18n: { ar: { title: title?.trim() || String(config.subtitle ?? ""), ...(subtitle ? { subtitle: subtitle.trim() } : {}) } },
    sections: [{ kind: segmented ? "segmented_rows" : "word_rows", items }],
    rules: (rulesAr[String(pageNo)] ?? []).map((r: { title: string; desc: string; html: string }, i: number) => {
      const enRule = rulesEn[String(pageNo)]?.[i];
      return {
        example: toRuleExample(r.html, String(pageNo)),
        i18n: {
          ar: { title: title?.trim() || r.title, description: r.desc },
          ...(enRule ? { en: { title: enRule.title, description: enRule.desc } } : {}),
        },
      };
    }),
    games: config.game3 === "riddles" ? { riddles: { enabled: true } } : {},
    source: `nur-albayan-pages/pages/${f}`,
  };
  writeFileSync(join(out, "pages", `${String(pageNo).padStart(3, "0")}.json`), JSON.stringify(lesson, null, 2) + "\n");
}

writeFileSync(join(out, "book.json"), JSON.stringify(book, null, 2) + "\n");
writeFileSync(
  join(out, "IMPORT_REPORT.md"),
  [
    "# Import report",
    "",
    `Imported ${files.length - manual.length} pages and ${itemCount} items from nur-albayan-pages as drafts.`,
    "Every lesson needs review against the printed book before it is published.",
    "",
    "## Pages to enter by hand",
    "",
    "These pages have no `dataset` list the importer can read:",
    "",
    manual.map((p) => `- page ${p}`).join("\n") || "- none",
    "",
    "## Warnings",
    "",
    report.join("\n") || "- none",
    "",
  ].join("\n"),
);
console.log(`Imported ${files.length - manual.length} pages, ${itemCount} items. Manual: ${manual.join(", ") || "none"}.`);
