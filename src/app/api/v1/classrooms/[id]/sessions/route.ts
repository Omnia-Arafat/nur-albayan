import { eq } from "drizzle-orm";
import { z } from "zod";

import * as s from "@/db/schema";
import { body, guard, privateJson, problem } from "@/lib/api";
import { isMember, ownsClassroom } from "@/modules/classroom/service";
import { recordSession } from "@/modules/progress/server";

const graded = z.object({
  studentId: z.uuid(),
  bookPage: z.number().int().positive(),
  clientSessionId: z.string().min(8).max(80),
  reads: z
    .array(z.object({ itemId: z.uuid(), result: z.enum(["correct", "wrong"]) }))
    .min(1)
    .max(400),
});

/** A teacher-graded session: the student read, the teacher marked each card. */
export async function POST(req: Request, ctx: RouteContext<"/api/v1/classrooms/[id]/sessions">) {
  const g = await guard("students.grade");
  if (g.error) return g.error;
  const { id } = await ctx.params;
  if (!(await ownsClassroom(g.db, g.viewer, id))) return problem(404, "No such classroom");
  const b = await body(req, graded);
  if (b.error) return b.error;
  if (!(await isMember(g.db, id, b.data.studentId))) return problem(404, "No such student in this classroom");
  const [lesson] = await g.db.select().from(s.lessons).where(eq(s.lessons.bookPage, b.data.bookPage));
  if (!lesson) return problem(404, "No lesson on that page");
  const out = await recordSession(g.db, {
    studentId: b.data.studentId,
    lessonId: lesson.id,
    reads: b.data.reads,
    gradedBy: "teacher",
    graderProfileId: g.viewer.profileId,
    clientSessionId: b.data.clientSessionId,
  });
  return privateJson(out, out.duplicate ? 200 : 201);
}
