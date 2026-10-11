import { describe, expect, it } from "vitest";

import { loadSeed } from "@/db/seed/files";

import { applySession, effectiveScore, emptyRecord, masteryStep, pointsFor, starsFor, summarize } from "./engine";

// The default profile is the seed's; these tests pin it to the rules of nur-albayan-pages.
const rules = loadSeed().scoringProfile.rules;
const card = (cardTypeKey: string, result: "correct" | "wrong", extra = {}) =>
  ({ surface: "card", cardTypeKey, result, gradedBy: "self", ...extra }) as const;

describe("pointsFor", () => {
  it("matches the card table", () => {
    expect(pointsFor(rules, card("normal", "correct"))).toBe(2);
    expect(pointsFor(rules, card("golden", "correct"))).toBe(10);
    expect(pointsFor(rules, card("speed", "correct"))).toBe(5);
    expect(pointsFor(rules, card("speed", "correct", { timedOut: true }))).toBe(2);
    expect(pointsFor(rules, card("danger", "wrong"))).toBe(-5);
    expect(pointsFor(rules, card("golden", "wrong"))).toBe(-2);
    expect(pointsFor(rules, card("danger", "wrong", { noPenalty: true }))).toBe(0);
  });

  it("adds the peak bonus on the ladder", () => {
    expect(pointsFor(rules, { surface: "ladder", cardTypeKey: "normal", result: "correct", reachedPeak: true })).toBe(7);
  });

  it("adds the mastery bonus in remediation", () => {
    expect(pointsFor(rules, { surface: "remediation", cardTypeKey: "normal", result: "correct", becameMastered: true })).toBe(7);
  });

  it("rejects an unknown card type", () => {
    expect(() => pointsFor(rules, card("missing", "correct"))).toThrow();
  });
});

describe("summarize", () => {
  it("floors the running score at zero", () => {
    const s = summarize(rules, [card("danger", "wrong"), card("normal", "correct")]);
    expect(s.score).toBe(2);
    expect(s.accuracy).toBe(0.5);
    expect(s.stars).toBe(1);
  });

  it("counts wordwall points but not remediation", () => {
    const s = summarize(rules, [
      card("normal", "correct"),
      { surface: "wordwall", cardTypeKey: "normal", result: "correct", gradedBy: "self" },
      { surface: "remediation", cardTypeKey: "normal", result: "correct", gradedBy: "self" },
    ]);
    expect(s.score).toBe(7);
  });

  it("awards stars at 90% and 70%", () => {
    expect(starsFor(rules, 0.9)).toBe(3);
    expect(starsFor(rules, 0.89)).toBe(2);
    expect(starsFor(rules, 0.7)).toBe(2);
    expect(starsFor(rules, 0.2)).toBe(1);
  });

  it("drops self-graded attempts when the profile says so", () => {
    const strict = { ...rules, selfGradedCounts: false };
    expect(summarize(strict, [card("golden", "correct")]).score).toBe(0);
  });
});

describe("lesson record", () => {
  it("applies each repeat policy and keeps the best stars", () => {
    const first = applySession(emptyRecord, { score: 30, correct: 9, wrong: 1, accuracy: 0.9, stars: 3 });
    const second = applySession(first, { score: 10, correct: 5, wrong: 5, accuracy: 0.5, stars: 1 });
    expect(effectiveScore("best", second)).toBe(30);
    expect(effectiveScore("latest", second)).toBe(10);
    expect(effectiveScore("cumulative", second)).toBe(40);
    expect(second.stars).toBe(3);
  });
});

describe("masteryStep", () => {
  it("masters after two correct in a row and resets on a miss", () => {
    let e = { missCount: 1, correctStreak: 0, mastered: false };
    e = masteryStep(rules, e, "correct");
    expect(e.mastered).toBe(false);
    e = masteryStep(rules, e, "wrong");
    expect(e).toEqual({ missCount: 2, correctStreak: 0, mastered: false });
    e = masteryStep(rules, masteryStep(rules, e, "correct"), "correct");
    expect(e.mastered).toBe(true);
  });
});
