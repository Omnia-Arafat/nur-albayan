import { z } from "zod";

import { body, guard, localeFrom, privateJson, problem } from "@/lib/api";
import { studentReport, updateStudent } from "@/modules/classroom/report";
import { isMember, moveStudent, ownsClassroom, removeStudent } from "@/modules/classroom/service";

/** The teacher's report on one student of the class. */
export async function GET(req: Request, ctx: RouteContext<"/api/v1/classrooms/[id]/students/[studentId]">) {
  const g = await guard("classrooms.manage");
  if (g.error) return g.error;
  const { id, studentId } = await ctx.params;
  if (!(await ownsClassroom(g.db, g.viewer, id))) return problem(404, "No such classroom");
  const { locale } = await localeFrom(req);
  const report = await studentReport(g.db, id, studentId, locale ?? "");
  return report ? privateJson(report) : problem(404, "No such student in this class");
}

const patch = z
  .object({
    displayName: z.string().trim().min(1).max(40).optional(),
    pin: z
      .string()
      .regex(/^\d{4,6}$/)
      .optional(),
    /** Another of the teacher's classes to move the student into. */
    moveTo: z.uuid().optional(),
  })
  .refine((p) => p.displayName || p.pin || p.moveTo, "Nothing to change");

export async function PATCH(req: Request, ctx: RouteContext<"/api/v1/classrooms/[id]/students/[studentId]">) {
  const g = await guard("classrooms.manage");
  if (g.error) return g.error;
  const { id, studentId } = await ctx.params;
  if (!(await ownsClassroom(g.db, g.viewer, id)) || !(await isMember(g.db, id, studentId)))
    return problem(404, "No such student in this class");
  const b = await body(req, patch);
  if (b.error) return b.error;
  if (b.data.moveTo) {
    if (b.data.moveTo === id || !(await ownsClassroom(g.db, g.viewer, b.data.moveTo)))
      return problem(404, "No such classroom");
    await moveStudent(g.db, id, b.data.moveTo, studentId);
  }
  await updateStudent(g.db, studentId, b.data);
  return privateJson({ ok: true });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/v1/classrooms/[id]/students/[studentId]">) {
  const g = await guard("classrooms.manage");
  if (g.error) return g.error;
  const { id, studentId } = await ctx.params;
  if (!(await ownsClassroom(g.db, g.viewer, id))) return problem(404, "No such classroom");
  await removeStudent(g.db, id, studentId);
  return privateJson({ ok: true });
}
