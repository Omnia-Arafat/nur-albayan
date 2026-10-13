import "server-only";

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import { and, asc, count, eq, gte, inArray, isNull, sql } from "drizzle-orm";

import type { Db } from "@/db/client";
import * as s from "@/db/schema";

export type StudentRow = {
  id: string;
  name: string;
  avatar: { kind: "letter" | "icon"; value: string };
  colorTokenKey: string;
  username: string | null;
  reachedPage: number | null;
  accuracy: number | null;
  streak: number;
  bankCount: number;
};

export type Overview = {
  classroom: { id: string; name: string; joinCode: string };
  days: number;
  kpis: { accuracy: number | null; lessonsDone: number; bankWords: number; readToday: number };
  students: StudentRow[];
  hardest: {
    itemId: string;
    script: "naskh" | "uthmani";
    segments: { text: string; role: string }[];
    students: number;
  }[];
};

/** The classrooms a teacher owns (an admin sees every classroom). */
export async function listClassrooms(db: Db, viewer: { profileId: string; roleKey: string }) {
  const rows = await db
    .select({
      id: s.classrooms.id,
      name: s.classrooms.name,
      joinCode: s.classrooms.joinCode,
      students: count(s.classroomMembers.studentId),
    })
    .from(s.classrooms)
    .leftJoin(s.classroomMembers, eq(s.classroomMembers.classroomId, s.classrooms.id))
    .where(
      viewer.roleKey === "admin"
        ? isNull(s.classrooms.archivedAt)
        : and(eq(s.classrooms.ownerTeacherId, viewer.profileId), isNull(s.classrooms.archivedAt)),
    )
    .groupBy(s.classrooms.id)
    .orderBy(asc(s.classrooms.name));
  return rows;
}

/** Whether this viewer may see and manage the classroom. */
export async function ownsClassroom(db: Db, viewer: { profileId: string; roleKey: string }, classroomId: string) {
  const [c] = await db.select().from(s.classrooms).where(eq(s.classrooms.id, classroomId));
  return Boolean(c && (viewer.roleKey === "admin" || c.ownerTeacherId === viewer.profileId));
}

export async function classroomStudents(db: Db, classroomId: string): Promise<StudentRow[]> {
  const rows = await db
    .select({ st: s.students, av: s.avatars, col: s.avatarColors })
    .from(s.classroomMembers)
    .innerJoin(s.students, eq(s.students.id, s.classroomMembers.studentId))
    .leftJoin(s.avatars, eq(s.avatars.id, s.students.avatarId))
    .leftJoin(s.avatarColors, eq(s.avatarColors.id, s.students.avatarColorId))
    .where(eq(s.classroomMembers.classroomId, classroomId))
    .orderBy(asc(s.students.displayName));
  const ids = rows.map((r) => r.st.id);
  if (!ids.length) return [];
  const [reached, acc, streaks, bank, [fallbackColour]] = await Promise.all([
    db
      .select({ studentId: s.lessonRecords.studentId, page: sql<number>`max(${s.lessons.bookPage})` })
      .from(s.lessonRecords)
      .innerJoin(s.lessons, eq(s.lessons.id, s.lessonRecords.lessonId))
      .where(and(inArray(s.lessonRecords.studentId, ids), gte(s.lessonRecords.completedCount, 1)))
      .groupBy(s.lessonRecords.studentId),
    db
      .select({ studentId: s.lessonRecords.studentId, accuracy: sql<string>`avg(${s.lessonRecords.accuracy})` })
      .from(s.lessonRecords)
      .where(inArray(s.lessonRecords.studentId, ids))
      .groupBy(s.lessonRecords.studentId),
    db.select().from(s.streaks).where(inArray(s.streaks.studentId, ids)),
    db
      .select({ studentId: s.mistakeBank.studentId, n: count() })
      .from(s.mistakeBank)
      .where(and(inArray(s.mistakeBank.studentId, ids), isNull(s.mistakeBank.masteredAt)))
      .groupBy(s.mistakeBank.studentId),
    db.select().from(s.avatarColors).orderBy(asc(s.avatarColors.position)).limit(1),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  return rows.map(({ st, av, col }) => {
    const letter = st.useFirstLetter || !av ? (Array.from(st.displayName)[0] ?? "") : (av.value ?? "");
    const streak = streaks.find((x) => x.studentId === st.id);
    const a = acc.find((x) => x.studentId === st.id)?.accuracy;
    return {
      id: st.id,
      name: st.displayName,
      avatar: { kind: av?.kind === "icon" && !st.useFirstLetter ? "icon" : "letter", value: letter },
      colorTokenKey: col?.tokenKey ?? fallbackColour?.tokenKey ?? "color.blue",
      username: st.username,
      reachedPage: reached.find((x) => x.studentId === st.id)?.page ?? null,
      accuracy: a == null ? null : Number(a),
      // A streak only counts while the student read today or yesterday.
      streak:
        streak?.lastActiveDay && Date.parse(today) - Date.parse(streak.lastActiveDay) <= 86_400_000
          ? streak.current
          : 0,
      bankCount: bank.find((x) => x.studentId === st.id)?.n ?? 0,
    };
  });
}

/** The teacher's overview for one classroom over the last `days` days. */
export async function classroomOverview(db: Db, classroomId: string, days = 7): Promise<Overview | null> {
  const [c] = await db.select().from(s.classrooms).where(eq(s.classrooms.id, classroomId));
  if (!c) return null;
  const students = await classroomStudents(db, classroomId);
  const ids = students.map((x) => x.id);
  const since = new Date(Date.now() - days * 86_400_000);
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  let kpis: Overview["kpis"] = { accuracy: null, lessonsDone: 0, bankWords: 0, readToday: 0 };
  let hardest: Overview["hardest"] = [];
  if (ids.length) {
    const [[acc], [done], [today], wrong] = await Promise.all([
      db
        .select({
          correct: sql<number>`count(*) filter (where ${s.attempts.result} = 'correct')`,
          total: count(),
        })
        .from(s.attempts)
        .innerJoin(s.sessions, eq(s.sessions.id, s.attempts.sessionId))
        .where(
          and(inArray(s.sessions.studentId, ids), gte(s.attempts.occurredAt, since), eq(s.attempts.surface, "card")),
        ),
      db
        .select({ n: count() })
        .from(s.sessions)
        .where(and(inArray(s.sessions.studentId, ids), gte(s.sessions.finishedAt, since))),
      db
        .select({ n: sql<number>`count(distinct ${s.sessions.studentId})` })
        .from(s.sessions)
        .where(and(inArray(s.sessions.studentId, ids), gte(s.sessions.finishedAt, dayStart))),
      db
        .select({ itemId: s.mistakeBank.itemId, n: count() })
        .from(s.mistakeBank)
        .where(and(inArray(s.mistakeBank.studentId, ids), isNull(s.mistakeBank.masteredAt)))
        .groupBy(s.mistakeBank.itemId)
        .orderBy(sql`count(*) desc`)
        .limit(5),
    ]);
    kpis = {
      accuracy: Number(acc.total) ? Number(acc.correct) / Number(acc.total) : null,
      lessonsDone: Number(done.n),
      bankWords: students.reduce((n, x) => n + x.bankCount, 0),
      readToday: Number(today.n),
    };
    const scripts = wrong.length
      ? await db
          .select({ id: s.items.id, script: s.items.script })
          .from(s.items)
          .where(
            inArray(
              s.items.id,
              wrong.map((w) => w.itemId),
            ),
          )
      : [];
    const segs = wrong.length
      ? await db
          .select()
          .from(s.itemSegments)
          .where(
            inArray(
              s.itemSegments.itemId,
              wrong.map((w) => w.itemId),
            ),
          )
          .orderBy(asc(s.itemSegments.position))
      : [];
    hardest = wrong.map((w) => ({
      itemId: w.itemId,
      script: scripts.find((x) => x.id === w.itemId)?.script ?? "naskh",
      students: Number(w.n),
      segments: segs.filter((g) => g.itemId === w.itemId).map((g) => ({ text: g.text, role: g.roleKey })),
    }));
  }
  return { classroom: { id: c.id, name: c.name, joinCode: c.joinCode }, days, kpis, students, hardest };
}

export const hashPin = (pin: string) => {
  const salt = randomBytes(16).toString("hex");
  return `scrypt:${salt}:${scryptSync(pin, salt, 32).toString("hex")}`;
};

export const checkPin = (pin: string, stored: string) => {
  const [, salt, hash] = stored.split(":");
  return timingSafeEqual(scryptSync(pin, salt, 32), Buffer.from(hash, "hex"));
};

/** A teacher adds a student to a classroom: a name, and optionally a username and PIN for signing in. */
export async function addStudent(
  db: Db,
  input: {
    classroomId: string;
    teacherId: string;
    displayName: string;
    username?: string;
    pin?: string;
    avatarId?: string;
    avatarColorId?: string;
  },
) {
  return db.transaction(async (tx) => {
    const [st] = await tx
      .insert(s.students)
      .values({
        displayName: input.displayName,
        username: input.username || null,
        pinHash: input.pin ? hashPin(input.pin) : null,
        avatarId: input.avatarId ?? null,
        avatarColorId: input.avatarColorId ?? null,
        useFirstLetter: !input.avatarId,
        createdByTeacherId: input.teacherId,
      })
      .returning();
    await tx.insert(s.classroomMembers).values({ classroomId: input.classroomId, studentId: st.id });
    return st;
  });
}

export async function removeStudent(db: Db, classroomId: string, studentId: string) {
  await db
    .delete(s.classroomMembers)
    .where(and(eq(s.classroomMembers.classroomId, classroomId), eq(s.classroomMembers.studentId, studentId)));
}

export async function isMember(db: Db, classroomId: string, studentId: string) {
  const [m] = await db
    .select()
    .from(s.classroomMembers)
    .where(and(eq(s.classroomMembers.classroomId, classroomId), eq(s.classroomMembers.studentId, studentId)));
  return Boolean(m);
}
