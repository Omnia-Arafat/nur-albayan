import { json, localeFrom, problem } from "@/lib/api";
import { listLessons } from "@/modules/content/service";

export async function GET(req: Request) {
  const { db, locale } = await localeFrom(req);
  if (!locale) return problem(404, "Unknown locale");
  return json({ lessons: await listLessons(db, locale) });
}
