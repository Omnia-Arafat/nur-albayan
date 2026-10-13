import "server-only";

import { and, asc, desc, eq, gte, inArray, isNull, isNotNull, sql, sum } from "drizzle-orm";

import type { Db } from "@/db/client";
import * as s from "@/db/schema";

import { classroomStudents, hashPin, type StudentRow } from "./service";

export type StudentReport = {
  classroom: { id: string; name: string };
  student: StudentRow;
  /** Game points uploaded from the student's devices (lesson points are worked out from `lessons`). */
  gamePoints: number;
  mastered: number;
  lessons: {
    lessonId: string;
    bookPage: number;
    title: string;
    stars: number;
    accuracy: number;
    bestScore: number;
    latestScore: number;
    cumulativeScore: number;
    completedCount: number;
    lastStudiedAt: string | null;
  }[];
  bank: {
    itemId: string;
    bookPage: number;
    script: "naskh" | "uthmani";
    segments: { text: string; role: string }[];
    missCount: number;
    correctStreak: number;
  }[];
  /** One row per day with any graded read in the last `days` days, newest first. */
  days: { day: string; reads: number; correct: number; byTeacher: number }[];
};

/** Everything a teacher sees about one student of their class: lessons, words to review and recent days. */
export async function studentReport(
  db: Db,
  classroomId: string,
  studentId: string,
  locale: string,
  days = 14,
): Promise<StudentReport | null> {
  const [c] = await db.select().from(s.classrooms).where(eq(s.classrooms.id, classroomId));
  const student = (await classroomStudents(db, classroomId)).find((x) => x.id === studentId);
  if (!c || !student) return null;
  const since = new Date(Date.now() - days * 86_400_000);
  const [records, bankRows, [xp], [mastered], daily] = await Promise.all([
    db
      .select({ r: s.lessonRecords, bookPage: s.lessons.bookPage })
      .from(s.lessonRecords)
      .innerJoin(s.lessons, eq(s.lessons.id, s.lessonRecords.lessonId))
      .where(eq(s.lessonRecords.studentId, studentId))
      .orderBy(asc(s.lessons.bookPage)),
    db
      .select({ m: s.mistakeBank, bookPage: s.lessons.bookPage, script: s.items.script })
      .from(s.mistakeBank)
      .innerJoin(s.lessons, eq(s.lessons.id, s.mistakeBank.lessonId))
      .innerJoin(s.items, eq(s.items.id, s.mistakeBank.itemId))
      .where(and(eq(s.mistakeBank.studentId, studentId), isNull(s.mistakeBank.masteredAt)))
      .orderBy(desc(s.mistakeBank.missCount), asc(s.lessons.bookPage)),
    db
      .select({ n: sum(s.xpLedger.amount) })
      .from(s.xpLedger)
      .where(eq(s.xpLedger.studentId, studentId)),
    db
      .select({ n: sql<number>`count(*)` })
      .from(s.mistakeBank)
      .where(and(eq(s.mistakeBank.studentId, studentId), isNotNull(s.mistakeBank.masteredAt))),
    db
      .select({
        day: sql<string>`to_char(${s.attempts.occurredAt}, 'YYYY-MM-DD')`,
        reads: sql<number>`count(*)`,
        correct: sql<number>`count(*) filter (where ${s.attempts.result} = 'correct')`,
        byTeacher: sql<number>`count(*) filter (where ${s.attempts.gradedBy} = 'teacher')`,
      })
      .from(s.attempts)
      .innerJoin(s.sessions, eq(s.sessions.id, s.attempts.sessionId))
      .where(and(eq(s.sessions.studentId, studentId), gte(s.attempts.occurredAt, since)))
      .groupBy(sql`1`)
      .orderBy(sql`1 desc`),
  ]);
  const lessonIds = records.map((x) => x.r.lessonId);
  const itemIds = bankRows.map((x) => x.m.itemId);
  const [titles, segs] = await Promise.all([
    lessonIds.length ? db.select().from(s.lessonsI18n).where(inArray(s.lessonsI18n.entityId, lessonIds)) : [],
    itemIds.length
      ? db
          .select()
          .from(s.itemSegments)
          .where(inArray(s.itemSegments.itemId, itemIds))
          .orderBy(asc(s.itemSegments.position))
      : [],
  ]);
  // The book is written in one language; a lesson without a title in this locale shows the book's own.
  const titleOf = (id: string) => {
    const all = titles.filter((x) => x.entityId === id);
    return (all.find((x) => x.locale === locale) ?? all[0])?.title ?? "";
  };
  return {
    classroom: { id: c.id, name: c.name },
    student,
    gamePoints: Number(xp?.n ?? 0),
    mastered: Number(mastered?.n ?? 0),
    lessons: records.map(({ r, bookPage }) => ({
      lessonId: r.lessonId,
      bookPage,
      title: titleOf(r.lessonId),
      stars: r.stars,
      accuracy: Number(r.accuracy),
      bestScore: r.bestScore,
      latestScore: r.latestScore,
      cumulativeScore: r.cumulativeScore,
      completedCount: r.completedCount,
      lastStudiedAt: r.lastStudiedAt?.toISOString() ?? null,
    })),
    bank: bankRows.map(({ m, bookPage, script }) => ({
      itemId: m.itemId,
      bookPage,
      script,
      missCount: m.missCount,
      correctStreak: m.correctStreak,
      segments: segs.filter((g) => g.itemId === m.itemId).map((g) => ({ text: g.text, role: g.roleKey })),
    })),
    days: daily.map((d) => ({
      day: d.day,
      reads: Number(d.reads),
      correct: Number(d.correct),
      byTeacher: Number(d.byTeacher),
    })),
  };
}

/** A teacher marks a word as learned, or clears every open word (itemId omitted). */
export async function masterMistakes(db: Db, studentId: string, itemId?: string) {
  await db
    .update(s.mistakeBank)
    .set({ masteredAt: new Date() })
    .where(
      and(
        eq(s.mistakeBank.studentId, studentId),
        isNull(s.mistakeBank.masteredAt),
        itemId ? eq(s.mistakeBank.itemId, itemId) : undefined,
      ),
    );
}

/**
 * Starts a lesson over for one student: its record and its open words go, so the next reading counts
 * as the first. The graded reads stay in the log, and points already earned are kept.
 */
export async function resetLesson(db: Db, studentId: string, lessonId: string) {
  await db.transaction(async (tx) => {
    await tx
      .delete(s.lessonRecords)
      .where(and(eq(s.lessonRecords.studentId, studentId), eq(s.lessonRecords.lessonId, lessonId)));
    await tx
      .delete(s.mistakeBank)
      .where(
        and(
          eq(s.mistakeBank.studentId, studentId),
          eq(s.mistakeBank.lessonId, lessonId),
          isNull(s.mistakeBank.masteredAt),
        ),
      );
  });
}

/** A teacher renames a student or gives them a new PIN (a forgotten one can't be shown, only replaced). */
export async function updateStudent(db: Db, studentId: string, patch: { displayName?: string; pin?: string }) {
  const set: Partial<typeof s.students.$inferInsert> = {};
  if (patch.displayName) set.displayName = patch.displayName;
  if (patch.pin) set.pinHash = hashPin(patch.pin);
  if (Object.keys(set).length) await db.update(s.students).set(set).where(eq(s.students.id, studentId));
}
