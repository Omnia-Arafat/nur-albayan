import { z } from "zod";

import { guard, privateJson, problem } from "@/lib/api";
import { resetLesson } from "@/modules/classroom/report";
import { isMember, ownsClassroom } from "@/modules/classroom/service";

/** Starts one lesson over for the student. */
export async function DELETE(
  _req: Request,
  ctx: RouteContext<"/api/v1/classrooms/[id]/students/[studentId]/lessons/[lessonId]">,
) {
  const g = await guard("classrooms.manage");
  if (g.error) return g.error;
  const { id, studentId, lessonId } = await ctx.params;
  if (!z.uuid().safeParse(lessonId).success) return problem(404, "No such lesson");
  if (!(await ownsClassroom(g.db, g.viewer, id)) || !(await isMember(g.db, id, studentId)))
    return problem(404, "No such student in this class");
  await resetLesson(g.db, studentId, lessonId);
  return privateJson({ ok: true });
}
