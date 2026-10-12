import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";

import type { Db } from "@/db/client";
import * as s from "@/db/schema";
import { applySession, masteryStep, pointsFor, summarize } from "@/modules/scoring/engine";
import { type ScoringRules, scoringRules } from "@/modules/scoring/profile";

import { dayKey } from "./local";

export type GradedRead = { itemId: string; result: "correct" | "wrong"; occurredAt?: Date };

/** The default scoring profile, with its id (stored on every session so scores can be recomputed). */
export async function defaultScoring(db: Db): Promise<{ id: string; rules: ScoringRules }> {
  const [p] = await db
    .select()
    .from(s.scoringProfiles)
    .where(eq(s.scoringProfiles.isDefault, true))
    .orderBy(desc(s.scoringProfiles.version))
    .limit(1);
  if (!p) throw new Error("no default scoring profile");
  return { id: p.id, rules: scoringRules.parse(p.rules) };
}

/**
 * Store one finished card session for a student (graded by them or by a teacher) and fold it into
 * the student's lesson record, mistake bank and streak, with the same engine the device uses.
 * `clientSessionId` makes an upload safe to repeat: a session already stored is skipped.
 */
export async function recordSession(
  db: Db,
  input: {
    studentId: string;
    lessonId: string;
    reads: GradedRead[];
    gradedBy: "self" | "teacher";
    graderProfileId: string | null;
    clientSessionId: string;
    settings?: Record<string, unknown>;
    at?: Date;
  },
) {
  const at = input.at ?? new Date();
  const { id: scoringProfileId, rules } = await defaultScoring(db);
  return db.transaction(async (tx) => {
    const [dupe] = await tx
      .select({ id: s.sessions.id })
      .from(s.sessions)
      .where(eq(s.sessions.clientSessionId, input.clientSessionId));
    if (dupe) return { sessionId: dupe.id, duplicate: true };

    const itemIds = [...new Set(input.reads.map((r) => r.itemId))];
    const itemRows = itemIds.length
      ? await tx
          .select({ id: s.items.id, cardTypeKey: s.items.cardTypeKey, lessonId: s.lessonSections.lessonId })
          .from(s.items)
          .innerJoin(s.lessonSections, eq(s.items.sectionId, s.lessonSections.id))
          .where(inArray(s.items.id, itemIds))
      : [];
    const byId = new Map(itemRows.map((r) => [r.id, r]));
    const reads = input.reads.filter((r) => byId.get(r.itemId)?.lessonId === input.lessonId);
    const scored = reads.map((r) => ({
      surface: "card" as const,
      cardTypeKey: byId.get(r.itemId)!.cardTypeKey,
      result: r.result,
      gradedBy: input.gradedBy,
    }));

    const [session] = await tx
      .insert(s.sessions)
      .values({
        studentId: input.studentId,
        lessonId: input.lessonId,
        scoringProfileId,
        settingsSnapshot: input.settings ?? {},
        clientSessionId: input.clientSessionId,
        startedAt: reads[0]?.occurredAt ?? at,
        finishedAt: at,
      })
      .returning({ id: s.sessions.id });
    if (reads.length)
      await tx.insert(s.attempts).values(
        reads.map((r, i) => ({
          sessionId: session.id,
          itemId: r.itemId,
          surface: "card" as const,
          result: r.result,
          points: pointsFor(rules, scored[i]),
          gradedBy: input.gradedBy,
          graderProfileId: input.graderProfileId,
          clientEventId: `${input.clientSessionId}:${i}`,
          occurredAt: r.occurredAt ?? at,
        })),
      );

    const summary = summarize(rules, scored);
    const key = and(eq(s.lessonRecords.studentId, input.studentId), eq(s.lessonRecords.lessonId, input.lessonId));
    const [prev] = await tx.select().from(s.lessonRecords).where(key);
    const next = applySession(
      prev ?? { bestScore: 0, latestScore: 0, cumulativeScore: 0, stars: 0, completedCount: 0 },
      summary,
    );
    const row = { ...next, accuracy: summary.accuracy.toFixed(4), lastStudiedAt: at };
    if (prev) await tx.update(s.lessonRecords).set(row).where(key);
    else await tx.insert(s.lessonRecords).values({ studentId: input.studentId, lessonId: input.lessonId, ...row });

    for (const r of reads) {
      const k = and(eq(s.mistakeBank.studentId, input.studentId), eq(s.mistakeBank.itemId, r.itemId));
      const [m] = await tx.select().from(s.mistakeBank).where(k);
      if (!m && r.result === "correct") continue;
      const step = masteryStep(
        rules,
        { missCount: m?.missCount ?? 0, correctStreak: m?.correctStreak ?? 0, mastered: Boolean(m?.masteredAt) },
        r.result,
      );
      const values = {
        missCount: step.missCount,
        correctStreak: step.correctStreak,
        lastMissedAt: r.result === "wrong" ? (r.occurredAt ?? at) : (m?.lastMissedAt ?? null),
        masteredAt: step.mastered ? (m?.masteredAt ?? at) : null,
      };
      if (m) await tx.update(s.mistakeBank).set(values).where(k);
      else
        await tx
          .insert(s.mistakeBank)
          .values({ studentId: input.studentId, itemId: r.itemId, lessonId: input.lessonId, ...values });
    }

    const today = dayKey(at);
    const [st] = await tx.select().from(s.streaks).where(eq(s.streaks.studentId, input.studentId));
    const yesterday = dayKey(new Date(at.getTime() - 86_400_000));
    const current = st?.lastActiveDay === today ? st.current : st?.lastActiveDay === yesterday ? st.current + 1 : 1;
    const streak = { current, longest: Math.max(st?.longest ?? 0, current), lastActiveDay: today };
    if (st) await tx.update(s.streaks).set(streak).where(eq(s.streaks.studentId, input.studentId));
    else await tx.insert(s.streaks).values({ studentId: input.studentId, ...streak });

    return { sessionId: session.id, duplicate: false, summary };
  });
}
