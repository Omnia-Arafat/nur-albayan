import type { ScoringRules, Surface } from "./profile";

export type GradeInput = {
  surface: Surface;
  cardTypeKey: string;
  result: "correct" | "wrong";
  timedOut?: boolean;
  noPenalty?: boolean;
  /** Ladder only: this correct answer reached the top rung. */
  reachedPeak?: boolean;
  /** Remediation only: this correct answer mastered the word. */
  becameMastered?: boolean;
};

export type ScoredAttempt = GradeInput & { gradedBy: "self" | "teacher" };

/** Points one graded read is worth, before the floor is applied. */
export function pointsFor(rules: ScoringRules, input: GradeInput): number {
  const correct = input.result === "correct";
  if (!correct && input.noPenalty) return rules.noPenaltyWrong;

  switch (input.surface) {
    case "card": {
      const rule = rules.cardTypes[input.cardTypeKey];
      if (!rule) throw new Error(`No scoring rule for card type "${input.cardTypeKey}"`);
      if (!correct) return rule.wrong;
      return input.timedOut ? (rule.lateCorrect ?? rule.correct) : rule.correct;
    }
    case "wordwall":
      return correct ? rules.surfaces.wordwall.correct : rules.surfaces.wordwall.wrong;
    case "ladder": {
      const { rung, slip, peakBonus } = rules.surfaces.ladder;
      if (!correct) return slip;
      return input.reachedPeak ? rung + peakBonus : rung;
    }
    case "review":
      return correct ? rules.surfaces.review.correct : rules.surfaces.review.wrong;
    case "remediation": {
      const { correct: ok, wrong, mastered } = rules.surfaces.remediation;
      if (!correct) return wrong;
      return input.becameMastered ? ok + mastered : ok;
    }
  }
}

export function starsFor(rules: ScoringRules, accuracy: number): number {
  const sorted = [...rules.stars].sort((a, b) => b.minAccuracy - a.minAccuracy);
  return sorted.find((s) => accuracy >= s.minAccuracy)?.stars ?? 0;
}

export type SessionSummary = {
  score: number;
  correct: number;
  wrong: number;
  accuracy: number;
  stars: number;
};

/**
 * Score a finished session from its attempts, in order. Only surfaces in
 * `recordSurfaces` count, and self-graded attempts only when the profile allows.
 * Accuracy and stars come from card attempts, which is what the learner read.
 */
export function summarize(rules: ScoringRules, attempts: ScoredAttempt[]): SessionSummary {
  let score = 0;
  let correct = 0;
  let wrong = 0;
  for (const a of attempts) {
    if (a.gradedBy === "self" && !rules.selfGradedCounts) continue;
    if (a.surface === "card") {
      if (a.result === "correct") correct++;
      else wrong++;
    }
    if (!rules.recordSurfaces.includes(a.surface)) continue;
    score = Math.max(rules.floor, score + pointsFor(rules, a));
  }
  const total = correct + wrong;
  const accuracy = total === 0 ? 0 : correct / total;
  return { score, correct, wrong, accuracy, stars: total === 0 ? 0 : starsFor(rules, accuracy) };
}

export type LessonRecord = {
  bestScore: number;
  latestScore: number;
  cumulativeScore: number;
  stars: number;
  completedCount: number;
};

export const emptyRecord: LessonRecord = {
  bestScore: 0,
  latestScore: 0,
  cumulativeScore: 0,
  stars: 0,
  completedCount: 0,
};

/** Fold a finished session into the lesson record. Stars only ever go up. */
export function applySession(record: LessonRecord, session: SessionSummary): LessonRecord {
  return {
    bestScore: Math.max(record.bestScore, session.score),
    latestScore: session.score,
    cumulativeScore: record.cumulativeScore + session.score,
    stars: Math.max(record.stars, session.stars),
    completedCount: record.completedCount + 1,
  };
}

/** The score that counts toward the learner's total, by repeat policy. */
export function effectiveScore(policy: ScoringRules["repeatPolicy"], record: LessonRecord): number {
  switch (policy) {
    case "best":
      return record.bestScore;
    case "latest":
      return record.latestScore;
    case "cumulative":
      return record.cumulativeScore;
  }
}

export type MistakeEntry = { missCount: number; correctStreak: number; mastered: boolean };

/** Update a mistake-bank entry after one read of that word. A miss resets the streak. */
export function masteryStep(rules: ScoringRules, entry: MistakeEntry, result: "correct" | "wrong"): MistakeEntry {
  if (result === "wrong") return { missCount: entry.missCount + 1, correctStreak: 0, mastered: false };
  const correctStreak = entry.correctStreak + 1;
  return { ...entry, correctStreak, mastered: correctStreak >= rules.mastery.consecutiveCorrect };
}
