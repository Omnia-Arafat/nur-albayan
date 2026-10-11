import { getDb } from "@/db/client";
import { json } from "@/lib/api";
import { getLocales } from "@/modules/i18n/service";

export async function GET() {
  return json({ locales: await getLocales(await getDb()) });
}
