import { z } from "zod";

import { body, guard, privateJson, problem } from "@/lib/api";
import { setThemeColour, themeColours } from "@/modules/admin/service";

export async function GET() {
  const g = await guard("theme.edit");
  if (g.error) return g.error;
  return privateJson({ themes: await themeColours(g.db) });
}

const put = z.object({ theme: z.string().min(1).max(60), key: z.string().min(1).max(80), value: z.string() });

/** Changes one colour of a theme; every page picks it up on its next load. */
export async function PUT(req: Request) {
  const g = await guard("theme.edit");
  if (g.error) return g.error;
  const b = await body(req, put);
  if (b.error) return b.error;
  const r = await setThemeColour(g.db, b.data);
  if (!r.ok) return problem(r.error === "colour" ? 400 : 404, r.error === "colour" ? "Use #RRGGBB" : "No such colour");
  return privateJson({ ok: true });
}
