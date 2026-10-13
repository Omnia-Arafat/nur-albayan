import { z } from "zod";

import { body, guard, privateJson, problem } from "@/lib/api";
import { updateBadge } from "@/modules/admin/service";

const patch = z.object({
  enabled: z.boolean().optional(),
  count: z.number().int().min(1).max(10_000).optional(),
  locale: z.string().min(2).max(12).optional(),
  name: z.string().trim().min(1).max(60).optional(),
  description: z.string().trim().min(1).max(200).optional(),
});

export async function PATCH(req: Request, ctx: RouteContext<"/api/v1/admin/badges/[key]">) {
  const g = await guard("scoring.edit");
  if (g.error) return g.error;
  const b = await body(req, patch);
  if (b.error) return b.error;
  return (await updateBadge(g.db, (await ctx.params).key, b.data))
    ? privateJson({ ok: true })
    : problem(404, "No such badge");
}
