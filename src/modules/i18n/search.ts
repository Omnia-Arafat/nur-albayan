/**
 * Text folded for searching, so what a reader types finds what they meant in Arabic or English:
 * case, accents and harakat are ignored, and Arabic letters written several ways count as one
 * (the alef forms, taa marbuta and haa, alef maqsura and yaa, the hamza seats), as do Arabic and
 * Latin digits. Joiners and the tatweel used to show letter shapes are dropped.
 */
// Written as code points so the source holds no Arabic text (see scripts/check-hardcoded.ts).
const re = (codes: string) => new RegExp(`[${codes}]`, "g");
const ch = (code: number) => String.fromCharCode(code);
const FOLD: [RegExp, string][] = [
  [re("\\u0622\\u0623\\u0625\\u0671\\u0672\\u0673"), ch(0x0627)],
  [re("\\u0629"), ch(0x0647)],
  [re("\\u0649\\u0626"), ch(0x064a)],
  [re("\\u0624"), ch(0x0648)],
  [re("\\u0640\\u200C\\u200D"), ""],
];
const DIGITS = re("\\u0660-\\u0669\\u06F0-\\u06F9");

export function foldForSearch(text: string): string {
  let s = text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
  for (const [pattern, to] of FOLD) s = s.replace(pattern, to);
  s = s.replace(DIGITS, (d) => String((d.charCodeAt(0) & 0xf) % 10));
  return s.replace(/\s+/g, " ").trim();
}

/** Whether every word of the query appears in the text, in any order. An empty query matches everything. */
export function matchesSearch(text: string, query: string): boolean {
  const hay = foldForSearch(text);
  return foldForSearch(query)
    .split(" ")
    .filter(Boolean)
    .every((w) => hay.includes(w));
}
