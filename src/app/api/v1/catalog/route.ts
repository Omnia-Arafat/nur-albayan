import { json, localeFrom, problem } from "@/lib/api";
import { getCatalog } from "@/modules/catalog/service";

export async function GET(req: Request) {
  const { db, locale } = await localeFrom(req);
  if (!locale) return problem(404, "Unknown locale");
  return json(await getCatalog(db, locale));
}
