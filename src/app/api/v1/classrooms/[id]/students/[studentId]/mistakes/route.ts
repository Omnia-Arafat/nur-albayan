import { z } from "zod";

import { body, guard, privateJson, problem } from "@/lib/api";
import { masterMistakes } from "@/modules/classroom/report";
import { isMember, ownsClassroom } from "@/modules/classroom/service";

/** Marks one word of the student's bank as learned, or every open word when itemId is left out. */
export async function POST(req: Request, ctx: RouteContext<"/api/v1/classrooms/[id]/students/[studentId]/mistakes">) {
  const g = await guard("classrooms.manage");
  if (g.error) return g.error;
  const { id, studentId } = await ctx.params;
  if (!(await ownsClassroom(g.db, g.viewer, id)) || !(await isMember(g.db, id, studentId)))
    return problem(404, "No such student in this class");
  const b = await body(req, z.object({ itemId: z.uuid().optional() }));
  if (b.error) return b.error;
  await masterMistakes(g.db, studentId, b.data.itemId);
  return privateJson({ ok: true });
}
