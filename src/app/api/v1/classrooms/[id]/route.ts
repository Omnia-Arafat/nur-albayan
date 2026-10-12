import { guard, privateJson, problem } from "@/lib/api";
import { classroomOverview, ownsClassroom } from "@/modules/classroom/service";

export async function GET(_req: Request, ctx: RouteContext<"/api/v1/classrooms/[id]">) {
  const g = await guard("reports.view");
  if (g.error) return g.error;
  const { id } = await ctx.params;
  if (!(await ownsClassroom(g.db, g.viewer, id))) return problem(404, "No such classroom");
  return privateJson(await classroomOverview(g.db, id));
}
