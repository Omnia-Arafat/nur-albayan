import { z } from "zod";

import { body, guard, privateJson, problem } from "@/lib/api";
import { messageTable, setMessage } from "@/modules/admin/service";

export async function GET() {
  const g = await guard("i18n.edit");
  if (g.error) return g.error;
  return privateJson(await messageTable(g.db));
}

const text = z.object({
  namespace: z.string().min(1).max(40),
  key: z.string().min(1).max(120),
  locale: z.string().min(2).max(12),
  value: z.string().trim().min(1).max(2000),
});

/** Writes one interface text in one locale. */
export async function PUT(req: Request) {
  const g = await guard("i18n.edit");
  if (g.error) return g.error;
  const b = await body(req, text);
  if (b.error) return b.error;
  const out = await setMessage(g.db, b.data);
  if (out.ok) return privateJson(out);
  return out.error === "unknown"
    ? problem(404, "No such text")
    : problem(400, "Placeholders differ", { reason: out.error });
}
