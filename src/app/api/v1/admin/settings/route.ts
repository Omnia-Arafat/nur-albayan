import { z } from "zod";

import { body, guard, privateJson, problem } from "@/lib/api";
import { setSetting, settingsAt } from "@/modules/settings/service";

export async function GET() {
  const g = await guard("settings.platform");
  if (g.error) return g.error;
  return privateJson(await settingsAt(g.db, "platform", null));
}

export async function PUT(req: Request) {
  const g = await guard("settings.platform");
  if (g.error) return g.error;
  const b = await body(req, z.object({ key: z.string(), value: z.unknown() }));
  if (b.error) return b.error;
  const out = await setSetting(g.db, "platform", null, b.data.key, b.data.value);
  return out.ok ? privateJson(out) : problem(400, out.error);
}
