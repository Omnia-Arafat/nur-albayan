import "server-only";

import { and, eq, inArray, isNull, sum } from "drizzle-orm";

import type { Db } from "@/db/client";
import * as s from "@/db/schema";

import { classroomStudents, type StudentRow } from "./service";

const KEY = "gamification.leaderboardEnabled";

/** Whether a class shows its leaderboard: the class's own setting, else the platform's, else the default. */
export async function leaderboardOn(db: Db, classroomId: string): Promise<boolean> {
  const [[own], [platform], [def]] = await Promise.all([
    db
      .select()
      .from(s.settings)
      .where(and(eq(s.settings.scope, "classroom"), eq(s.settings.scopeId, classroomId), eq(s.settings.key, KEY))),
    db
      .select()
      .from(s.settings)
      .where(and(eq(s.settings.scope, "platform"), isNull(s.settings.scopeId), eq(s.settings.key, KEY))),
    db.select().from(s.settingDefinitions).where(eq(s.settingDefinitions.key, KEY)),
  ]);
  return (own ?? platform ?? { value: def?.defaultValue })?.value === true;
}

export type LeaderRow = {
  id: string;
  name: string;
  avatar: StudentRow["avatar"];
  colorTokenKey: string;
  gamePoints: number;
  /** Finished pages, for the points the learner sees in their header (see studentPoints). */
  lessons: { stars: number; bestScore: number; latestScore: number; cumulativeScore: number; completedCount: number }[];
};

/** Each student of a class with what their points are made of; the page ranks them. */
export async function classLeaderboard(db: Db, classroomId: string): Promise<LeaderRow[]> {
  const students = await classroomStudents(db, classroomId);
  const ids = students.map((x) => x.id);
  if (!ids.length) return [];
  const [records, xp] = await Promise.all([
    db.select().from(s.lessonRecords).where(inArray(s.lessonRecords.studentId, ids)),
    db
      .select({ studentId: s.xpLedger.studentId, n: sum(s.xpLedger.amount) })
      .from(s.xpLedger)
      .where(inArray(s.xpLedger.studentId, ids))
      .groupBy(s.xpLedger.studentId),
  ]);
  return students.map((st) => ({
    id: st.id,
    name: st.name,
    avatar: st.avatar,
    colorTokenKey: st.colorTokenKey,
    gamePoints: Number(xp.find((x) => x.studentId === st.id)?.n ?? 0),
    lessons: records
      .filter((r) => r.studentId === st.id)
      .map((r) => ({
        stars: r.stars,
        bestScore: r.bestScore,
        latestScore: r.latestScore,
        cumulativeScore: r.cumulativeScore,
        completedCount: r.completedCount,
      })),
  }));
}

/** The classes a student belongs to whose leaderboard is on. */
export async function studentLeaderboards(db: Db, studentId: string) {
  const rooms = await db
    .select({ id: s.classrooms.id, name: s.classrooms.name })
    .from(s.classroomMembers)
    .innerJoin(s.classrooms, eq(s.classrooms.id, s.classroomMembers.classroomId))
    .where(and(eq(s.classroomMembers.studentId, studentId), isNull(s.classrooms.archivedAt)));
  const out = [];
  for (const r of rooms) if (await leaderboardOn(db, r.id)) out.push({ ...r, rows: await classLeaderboard(db, r.id) });
  return out;
}
