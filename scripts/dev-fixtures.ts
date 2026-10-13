/**
 * Sample people for the local database only (never for Supabase): one admin, one teacher, a classroom
 * and a few students with a week of graded reading, so the teacher and admin screens have something to show.
 * Sessions go through recordSession, the same code the app uses, so the numbers are real engine output.
 * The reading content itself always comes from the book (seed/content).
 */
import { and, asc, eq, inArray } from "drizzle-orm";

import type { Db } from "../src/db/client";
import * as s from "../src/db/schema";
import { hashPin } from "../src/modules/classroom/service";
import { recordSession } from "../src/modules/progress/server";

export const FIXTURE_ADMIN = "00000000-0000-4000-8000-00000000a001";
export const FIXTURE_TEACHER = "00000000-0000-4000-8000-00000000a002";

const STUDENTS: { name: string; reach: number; skill: number }[] = [
  { name: "مريم", reach: 41, skill: 0.92 },
  { name: "يوسف", reach: 39, skill: 0.74 },
  { name: "آدم", reach: 40, skill: 0.85 },
  { name: "سارة", reach: 38, skill: 0.62 },
  { name: "عمر", reach: 41, skill: 0.96 },
  { name: "ليلى", reach: 37, skill: 0.8 },
];

/** A repeatable pseudo-random number in [0, 1) for a string. */
const rand = (key: string) => {
  let h = 2166136261;
  for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return ((h >>> 0) % 10_000) / 10_000;
};

export async function runDevFixtures(db: Db) {
  const [has] = await db.select().from(s.profiles).where(eq(s.profiles.id, FIXTURE_TEACHER));
  if (has) return false;
  await db.insert(s.profiles).values([
    { id: FIXTURE_ADMIN, displayName: "المشرف", roleKey: "admin", locale: "ar" },
    { id: FIXTURE_TEACHER, displayName: "أ. هدى", roleKey: "teacher", locale: "ar" },
  ]);
  const [room] = await db
    .insert(s.classrooms)
    .values({ ownerTeacherId: FIXTURE_TEACHER, name: "فصل الزهور", joinCode: "ZAHR41" })
    .returning();
  await db.insert(s.classrooms).values({ ownerTeacherId: FIXTURE_TEACHER, name: "مجموعة المسجد", joinCode: "MSJD09" });

  const colours = await db.select().from(s.avatarColors).orderBy(asc(s.avatarColors.position));
  const lessons = await db
    .select()
    .from(s.lessons)
    .where(inArray(s.lessons.bookPage, [36, 37, 38, 39, 40, 41]));
  const items = await db
    .select({ id: s.items.id, lessonId: s.lessonSections.lessonId })
    .from(s.items)
    .innerJoin(s.lessonSections, eq(s.lessonSections.id, s.items.sectionId))
    .where(
      and(
        inArray(
          s.lessonSections.lessonId,
          lessons.map((l) => l.id),
        ),
        eq(s.items.isDrillable, true),
      ),
    );

  for (const [k, st] of STUDENTS.entries()) {
    const [row] = await db
      .insert(s.students)
      .values({
        displayName: st.name,
        useFirstLetter: true,
        avatarColorId: colours[k % colours.length]?.id,
        username: `student${k + 1}`,
        pinHash: hashPin("1234"),
        createdByTeacherId: FIXTURE_TEACHER,
      })
      .returning();
    await db.insert(s.classroomMembers).values({ classroomId: room.id, studentId: row.id });
    const pages = lessons.filter((l) => l.bookPage <= st.reach).sort((a, b) => a.bookPage - b.bookPage);
    for (const [d, lesson] of pages.entries()) {
      const at = new Date(Date.now() - (pages.length - 1 - d) * 86_400_000);
      const reads = items
        .filter((i) => i.lessonId === lesson.id)
        .map((i) => ({
          itemId: i.id,
          result: rand(`${row.id}:${i.id}`) < st.skill ? ("correct" as const) : ("wrong" as const),
          occurredAt: at,
        }));
      await recordSession(db, {
        studentId: row.id,
        lessonId: lesson.id,
        reads,
        gradedBy: k % 2 ? "self" : "teacher",
        graderProfileId: k % 2 ? null : FIXTURE_TEACHER,
        clientSessionId: `fixture:${row.id}:${lesson.bookPage}`,
        at,
      });
    }
  }
  return true;
}
