import { describe, expect, it } from "vitest";

import { linkedTo, mergeRemote, newProfile, progressKey } from "./local";

const day = new Date(2026, 9, 13);
const base = newProfile("p1", "R", { kind: "letter", value: "x" }, "color.blue", day);
const rec = (best: number, stars: number, done = 1) => ({
  bestScore: best,
  latestScore: best,
  cumulativeScore: best,
  stars,
  completedCount: done,
});
const miss = (id: string, n: number, mastered = false, at = "2026-10-13T10:00:00.000Z") => ({
  itemId: id,
  bookPage: 41,
  segments: [{ text: "x", role: "target" }],
  missCount: n,
  correctStreak: 0,
  mastered,
  updatedAt: at,
});

describe("account sync", () => {
  it("keeps the better of each value and joins days, badges and words", () => {
    const local = { ...base, records: { "41": rec(10, 1) }, days: ["2026-10-12"], badges: ["a"], gamePoints: 5 };
    const remote = {
      ...base,
      records: { "41": rec(14, 3, 2), "42": rec(8, 2) },
      mistakes: { w: miss("w", 2) },
      days: ["2026-10-11"],
      badges: ["b"],
      gamePoints: 3,
    };
    const m = mergeRemote(local, remote);
    expect(m.records["41"]).toMatchObject({ bestScore: 14, stars: 3, completedCount: 2 });
    expect(m.records["42"].stars).toBe(2);
    expect(m.mistakes.w.missCount).toBe(2);
    expect(m.days).toEqual(["2026-10-11", "2026-10-12"]);
    expect(m.badges.sort()).toEqual(["a", "b"]);
    expect(m.gamePoints).toBe(5);
  });

  it("drops a page or word the account held last time but no longer has", () => {
    const synced = linkedTo({ ...base, records: { "41": rec(10, 1) }, mistakes: { w: miss("w", 1) } }, "s1", day);
    const local = { ...synced, records: { ...synced.records, "43": rec(5, 1) } };
    const m = mergeRemote(local, { ...base });
    expect(Object.keys(m.records)).toEqual(["43"]);
    expect(m.mistakes).toEqual({});
  });

  it("carries a word a teacher marked learned", () => {
    const local = { ...base, mistakes: { w: miss("w", 2, false, "2026-10-13T09:00:00.000Z") } };
    const m = mergeRemote(local, { ...base, mistakes: { w: miss("w", 1, true) } });
    expect(m.mistakes.w).toMatchObject({ mastered: true, missCount: 2 });
  });

  it("ignores sync bookkeeping when deciding whether to save", () => {
    expect(progressKey(linkedTo(base, "s1", day))).toBe(progressKey(base));
  });
});
