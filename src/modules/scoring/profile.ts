import { z } from "zod";

const points = z.number().int();

/** Points for one card type on the card surface. */
export const cardTypeRule = z.object({
  correct: points,
  wrong: points,
  /** Correct after the speed timer ran out (speed cards). Defaults to `correct`. */
  lateCorrect: points.optional(),
});

export const surfaceKeys = ["card", "wordwall", "ladder", "review", "remediation"] as const;
export type Surface = (typeof surfaceKeys)[number];

export const scoringRules = z.object({
  /** The running score never drops below this. */
  floor: points,
  cardTypes: z.record(z.string(), cardTypeRule),
  /** Points for a wrong answer when the no-penalty setting is on. */
  noPenaltyWrong: points,
  surfaces: z.object({
    wordwall: z.object({ correct: points, wrong: points }),
    ladder: z.object({ rung: points, slip: points, peakBonus: points }),
    review: z.object({ correct: points, wrong: points }),
    remediation: z.object({ correct: points, wrong: points, mastered: points }),
  }),
  /** Which surfaces add to the lesson record. */
  recordSurfaces: z.array(z.enum(surfaceKeys)).min(1),
  /** Highest threshold first: accuracy >= minAccuracy earns `stars`. */
  stars: z
    .array(z.object({ minAccuracy: z.number().min(0).max(1), stars: z.number().int().min(0) }))
    .min(1),
  repeatPolicy: z.enum(["best", "latest", "cumulative"]),
  mastery: z.object({ consecutiveCorrect: z.number().int().min(1) }),
  instantRepeat: z.object({ required: z.number().int().min(1) }),
  /** Whether attempts graded by the learner themself count toward the record. */
  selfGradedCounts: z.boolean(),
});

export type ScoringRules = z.infer<typeof scoringRules>;
