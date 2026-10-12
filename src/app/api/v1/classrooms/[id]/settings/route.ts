import { z } from "zod";

import { body, guard, privateJson, problem } from "@/lib/api";
import { ownsClassroom } from "@/modules/classroom/service";
import { setSetting, settingsAt } from "@/modules/settings/service";

export async function GET(_req: Request, ctx: RouteContext<"/api/v1/classrooms/[id]/settings">) {
  const g = await guard("classrooms.manage");
  if (g.error) return g.error;
  const { id } = await ctx.params;
  if (!(await ownsClassroom(g.db, g.viewer, id))) return problem(404, "No such classroom");
  return privateJson(await settingsAt(g.db, "classroom", id));
}

export async function PUT(req: Request, ctx: RouteContext<"/api/v1/classrooms/[id]/settings">) {
  const g = await guard("classrooms.manage");
  if (g.error) return g.error;
  const { id } = await ctx.params;
  if (!(await ownsClassroom(g.db, g.viewer, id))) return problem(404, "No such classroom");
  const b = await body(req, z.object({ key: z.string(), value: z.unknown() }));
  if (b.error) return b.error;
  const out = await setSetting(g.db, "classroom", id, b.data.key, b.data.value);
  return out.ok ? privateJson(out) : problem(400, out.error);
}
