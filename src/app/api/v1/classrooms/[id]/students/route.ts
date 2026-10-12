import { z } from "zod";

import { body, guard, privateJson, problem } from "@/lib/api";
import { addStudent, classroomStudents, ownsClassroom } from "@/modules/classroom/service";

const newStudent = z.object({
  displayName: z.string().trim().min(1).max(40),
  username: z
    .string()
    .trim()
    .regex(/^[a-z0-9._-]{3,24}$/i)
    .optional()
    .or(z.literal("")),
  pin: z
    .string()
    .regex(/^\d{4,6}$/)
    .optional()
    .or(z.literal("")),
});

export async function GET(_req: Request, ctx: RouteContext<"/api/v1/classrooms/[id]/students">) {
  const g = await guard("classrooms.manage");
  if (g.error) return g.error;
  const { id } = await ctx.params;
  if (!(await ownsClassroom(g.db, g.viewer, id))) return problem(404, "No such classroom");
  return privateJson(await classroomStudents(g.db, id));
}

export async function POST(req: Request, ctx: RouteContext<"/api/v1/classrooms/[id]/students">) {
  const g = await guard("classrooms.manage");
  if (g.error) return g.error;
  const { id } = await ctx.params;
  if (!(await ownsClassroom(g.db, g.viewer, id))) return problem(404, "No such classroom");
  const b = await body(req, newStudent);
  if (b.error) return b.error;
  try {
    const st = await addStudent(g.db, {
      classroomId: id,
      teacherId: g.viewer.profileId,
      displayName: b.data.displayName,
      username: b.data.username?.toLowerCase() || undefined,
      pin: b.data.pin || undefined,
    });
    return privateJson({ id: st.id }, 201);
  } catch (e) {
    if (String((e as { cause?: { code?: string } }).cause?.code ?? (e as { code?: string }).code) === "23505")
      return problem(409, "username taken");
    throw e;
  }
}
