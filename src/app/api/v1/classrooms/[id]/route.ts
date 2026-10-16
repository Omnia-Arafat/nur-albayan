import { z } from "zod";

import { body, guard, privateJson, problem } from "@/lib/api";
import { classroomOverview, ownsClassroom, updateClassroom } from "@/modules/classroom/service";

export async function GET(_req: Request, ctx: RouteContext<"/api/v1/classrooms/[id]">) {
  const g = await guard("reports.view");
  if (g.error) return g.error;
  const { id } = await ctx.params;
  if (!(await ownsClassroom(g.db, g.viewer, id))) return problem(404, "No such classroom");
  return privateJson(await classroomOverview(g.db, id));
}

const patch = z
  .object({ name: z.string().trim().min(1).max(60).optional(), archived: z.boolean().optional() })
  .refine((p) => p.name !== undefined || p.archived !== undefined, "Nothing to change");

/** Renames or archives a class. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/v1/classrooms/[id]">) {
  const g = await guard("classrooms.manage");
  if (g.error) return g.error;
  const { id } = await ctx.params;
  if (!(await ownsClassroom(g.db, g.viewer, id))) return problem(404, "No such classroom");
  const b = await body(req, patch);
  if (b.error) return b.error;
  await updateClassroom(g.db, id, b.data);
  return privateJson({ ok: true });
}
