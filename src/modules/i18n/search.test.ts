import { describe, expect, it } from "vitest";

import { foldForSearch, matchesSearch } from "./search";

describe("search folding", () => {
  it("ignores case and Latin accents", () => {
    expect(matchesSearch("Evening Group", "evening")).toBe(true);
    expect(matchesSearch("Café club", "CAFE")).toBe(true);
  });
  it("ignores harakat and treats letter forms as one", () => {
    expect(matchesSearch("فَصْلُ الزُّهُور", "فصل الزهور")).toBe(true);
    expect(matchesSearch("مجموعة أحمد", "احمد")).toBe(true);
    expect(matchesSearch("مجموعة إسلام", "اسلام")).toBe(true);
    expect(matchesSearch("حلقة المسجد", "حلقه")).toBe(true);
    expect(matchesSearch("مستوى أول", "مستوي")).toBe(true);
  });
  it("matches as each letter is typed, and words in any order", () => {
    expect(matchesSearch("فصل الزهور", "ف")).toBe(true);
    expect(matchesSearch("فصل الزهور", "الزه فص")).toBe(true);
    expect(matchesSearch("فصل الزهور", "قمر")).toBe(false);
    expect(matchesSearch("anything", "  ")).toBe(true);
  });
  it("reads Arabic digits as Latin ones", () => {
    expect(foldForSearch("فصل ٣")).toBe(foldForSearch("فصل 3"));
    expect(matchesSearch("Class ۲", "2")).toBe(true);
  });
});
