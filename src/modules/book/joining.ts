/**
 * Colouring part of an Arabic word means splitting it into runs, and a run boundary can break the
 * letters' joining in some browsers (حَ + لۡ drawn as two isolated letters, marks adrift). A zero-width
 * joiner on both sides of a boundary keeps the joined forms, but only where the letters really join:
 * the letter before must be one that joins to the next (not ا د ذ ر ز و ...), and the next must be a letter.
 */
const ZWJ = "\u200D";

/** Letters that connect to the following letter (dual-joining: ب ت ث ج ح خ س ... ي ى ئ), plus tatweel. */
const JOINS_NEXT = new Set(
  "\u0628\u062A\u062B\u062C\u062D\u062E\u0633\u0634\u0635\u0636\u0637\u0638\u0639\u063A\u0641\u0642\u0643\u0644\u0645\u0646\u0647\u064A\u0649\u0626\u0640",
);
/** Base letters (not marks): anything in the Arabic letter ranges. */
const LETTER = /[\u0621-\u064A\u0671-\u06D3\u06FA-\u06FF]/;

const TATWEEL = "\u0640";

const lastLetter = (s: string) => {
  for (let i = s.length - 1; i >= 0; i--)
    if (LETTER.test(s[i]) || s[i] === TATWEEL) return s[i];
  return undefined;
};
const firstLetter = (s: string) => {
  for (const ch of s) if (LETTER.test(ch) || ch === TATWEEL) return ch;
  return undefined;
};

/**
 * Returns the runs' texts with joiners added at boundaries inside a word. A boundary next to a space or
 * the start/end of the word gets nothing.
 */
export function joinRuns(texts: string[]): string[] {
  const out = [...texts];
  for (let i = 0; i < out.length - 1; i++) {
    const a = texts[i];
    const b = texts[i + 1];
    if (/\s$/.test(a) || /^\s/.test(b)) continue;
    const prev = lastLetter(a);
    const next = firstLetter(b);
    if (!prev || !next || !JOINS_NEXT.has(prev)) continue;
    out[i] = out[i] + ZWJ;
    out[i + 1] = ZWJ + out[i + 1];
  }
  return out;
}
