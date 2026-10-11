import { json, localeFrom, pageParam, problem } from "@/lib/api";
import { getLesson } from "@/modules/content/service";

export async function GET(req: Request, ctx: RouteContext<"/api/v1/lessons/[page]">) {
  const page = pageParam.safeParse((await ctx.params).page);
  if (!page.success) return problem(400, "page must be a positive integer");
  const { db, locale } = await localeFrom(req);
  if (!locale) return problem(404, "Unknown locale");
  const lesson = await getLesson(db, page.data, locale);
  return lesson ? json(lesson) : problem(404, "No lesson on that page");
}
