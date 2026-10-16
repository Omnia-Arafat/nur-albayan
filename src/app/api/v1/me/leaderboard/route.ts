import { eq } from "drizzle-orm";

import * as s from "@/db/schema";
import { guard, privateJson } from "@/lib/api";
import { studentLeaderboards } from "@/modules/classroom/leaderboard";

/** The leaderboards of the signed-in learner's classes, where the teacher switched them on. */
export async function GET() {
  const g = await guard("progress.own");
  // A guest reader simply has no classes, so the badges page asks without first checking who is in.
  if (g.error)
    return g.viewer === null && g.error.status === 401 ? privateJson({ studentId: null, classes: [] }) : g.error;
  const studentId =
    g.viewer.studentId ??
    (await g.db.select({ id: s.students.id }).from(s.students).where(eq(s.students.profileId, g.viewer.profileId)))[0]
      ?.id;
  if (!studentId) return privateJson({ studentId: null, classes: [] });
  return privateJson({ studentId, classes: await studentLeaderboards(g.db, studentId) });
}
