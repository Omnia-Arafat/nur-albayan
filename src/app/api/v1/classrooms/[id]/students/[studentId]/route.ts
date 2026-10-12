import { guard, privateJson, problem } from "@/lib/api";
import { ownsClassroom, removeStudent } from "@/modules/classroom/service";

export async function DELETE(_req: Request, ctx: RouteContext<"/api/v1/classrooms/[id]/students/[studentId]">) {
  const g = await guard("classrooms.manage");
  if (g.error) return g.error;
  const { id, studentId } = await ctx.params;
  if (!(await ownsClassroom(g.db, g.viewer, id))) return problem(404, "No such classroom");
  await removeStudent(g.db, id, studentId);
  return privateJson({ ok: true });
}
