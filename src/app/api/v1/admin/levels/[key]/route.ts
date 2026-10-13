import { z } from "zod";

import { body, guard, privateJson, problem } from "@/lib/api";
import { updateLevel } from "@/modules/admin/service";

const patch = z.object({
  xpThreshold: z.number().int().min(0).max(10_000_000).optional(),
  locale: z.string().min(2).max(12).optional(),
  name: z.string().trim().min(1).max(60).optional(),
});

export async function PATCH(req: Request, ctx: RouteContext<"/api/v1/admin/levels/[key]">) {
  const g = await guard("scoring.edit");
  if (g.error) return g.error;
  const b = await body(req, patch);
  if (b.error) return b.error;
  const out = await updateLevel(g.db, (await ctx.params).key, b.data);
  if (out.ok) return privateJson(out);
  return out.error === "unknown" ? problem(404, "No such level") : problem(400, "Out of order", { reason: out.error });
}
