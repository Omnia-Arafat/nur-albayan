import { json, localeFrom, problem } from "@/lib/api";
import { getMessages } from "@/modules/i18n/service";

export async function GET(req: Request) {
  const { db, locale } = await localeFrom(req);
  if (!locale) return problem(404, "Unknown locale");
  return json({ locale, messages: await getMessages(db, locale) });
}
