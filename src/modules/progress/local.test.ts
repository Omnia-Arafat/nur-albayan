import { describe, expect, it } from "vitest";

import { loadSeed } from "@/db/seed/files";
import { scoringRules } from "@/modules/scoring/profile";

import { dayKey, earnedBadges, finishLesson, levelOf, newProfile, reviewMistake, streakOf, xpOf } from "./local";

const seed = loadSeed();
const rules = scoringRules.parse(seed.scoringProfile.rules);
const word = (id: string, result: "correct" | "wrong") => ({
  itemId: id,
  cardTypeKey: "normal",
  segments: [{ text: "x", role: "target" }],
  result,
  gradedBy: "teacher" as const,
});

describe("device progress", () => {
  const day = new Date(2026, 9, 11);
  const fresh = newProfile("p1", "R", { kind: "letter", value: "x" }, "color.blue", day);

  it("records a finished lesson and banks the missed words", () => {
    const reads = [word("a", "correct"), word("b", "wrong"), word("c", "correct"), word("b", "correct")];
    const { profile, summary, missed } = finishLesson(fresh, rules, 41, reads, day);
    expect(summary.correct).toBe(3);
    expect(profile.records["41"].completedCount).toBe(1);
    expect(Object.keys(profile.mistakes)).toEqual(["b"]);
    expect(profile.mistakes.b.correctStreak).toBe(1);
    expect(missed.map((m) => m.itemId)).toEqual(["b"]);
    expect(profile.days).toEqual([dayKey(day)]);
  });

  it("masters a banked word after the configured streak", () => {
    let p = finishLesson(fresh, rules, 41, [word("b", "wrong")], day).profile;
    for (let i = 0; i < rules.mastery.consecutiveCorrect; i++) p = reviewMistake(p, rules, "b", "correct", day);
    expect(p.mistakes.b.mastered).toBe(true);
  });

  it("counts a streak through yesterday and finds the level by points", () => {
    const p = { ...fresh, days: ["2026-10-09", "2026-10-10"] };
    expect(streakOf(p, day)).toBe(2);
    const levels = seed.levels.map((l) => ({ ...l, name: l.key }));
    expect(levelOf(levels, 0).current.position).toBe(1);
    expect(levelOf(levels, 10_000).next).toBeNull();
    expect(xpOf(fresh, rules, { perLesson: 20, perStar: 5 })).toBe(0);
    const done = finishLesson(fresh, rules, 41, [word("a", "correct")], day).profile;
    expect(xpOf(done, rules, { perLesson: 20, perStar: 5 })).toBe(20 + 3 * 5 + 2);
    // Game points (word wall, ladder) count toward the level too.
    expect(xpOf({ ...done, gamePoints: 7 }, rules, { perLesson: 20, perStar: 5 })).toBe(20 + 3 * 5 + 2 + 7);
  });

  it("awards badges from their data rules", () => {
    const p = finishLesson(fresh, rules, 41, [word("a", "correct")], day).profile;
    expect(earnedBadges(p, seed.badges, day)).toContain("first-lesson");
    expect(earnedBadges(fresh, seed.badges, day)).toEqual([]);
  });
});
