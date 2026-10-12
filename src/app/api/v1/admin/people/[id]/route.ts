import { z } from "zod";

import { body, guard, privateJson, problem } from "@/lib/api";
import { updatePerson } from "@/modules/people/service";

export async function PATCH(req: Request, ctx: RouteContext<"/api/v1/admin/people/[id]">) {
  const g = await guard("users.manage");
  if (g.error) return g.error;
  const { id } = await ctx.params;
  const b = await body(
    req,
    z.object({ roleKey: z.string().optional(), status: z.enum(["active", "disabled"]).optional() }),
  );
  if (b.error) return b.error;
  // An admin can't lock themself out.
  if (id === g.viewer.profileId) return problem(409, "You can't change your own account here");
  const out = await updatePerson(g.db, id, b.data);
  return out.ok ? privateJson(out) : problem(400, out.error);
}
