/** Print a pages-repo import as book-format rows, as a typing aid to check against the scan. */
import { readFileSync } from "node:fs";

import { formatItem } from "./dsl";

const [file, colsArg] = process.argv.slice(2);
const cols = Number(colsArg ?? 5);
const lesson = JSON.parse(readFileSync(file, "utf8"));
const items = lesson.sections.flatMap((s: { items: unknown[] }) => s.items) as {
  cardType: string;
  segments: { text: string; role: string; cellBreakAfter?: boolean }[];
}[];
console.log(`// import: ${lesson.i18n.ar.title} | ${lesson.i18n.ar.subtitle ?? ""} | ${items.length} items`);
for (let i = 0; i < items.length; i += cols) {
  console.log(items.slice(i, i + cols).map((it) => formatItem(it.cardType, it.segments)).join(" ; "));
}
