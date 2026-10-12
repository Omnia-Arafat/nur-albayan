import { body, guard, pageParam, privateJson, problem } from "@/lib/api";
import { pageEdit, pageForEdit, savePage } from "@/modules/content/editor";

export async function GET(req: Request, ctx: RouteContext<"/api/v1/admin/lessons/[page]">) {
  const g = await guard("content.edit");
  if (g.error) return g.error;
  const page = pageParam.safeParse((await ctx.params).page);
  if (!page.success) return problem(400, "page must be a positive integer");
  const locale = new URL(req.url).searchParams.get("locale") ?? "ar";
  const data = await pageForEdit(g.db, page.data, locale);
  return data ? privateJson(data) : problem(404, "No lesson on that page");
}

export async function PUT(req: Request, ctx: RouteContext<"/api/v1/admin/lessons/[page]">) {
  const g = await guard("content.edit");
  if (g.error) return g.error;
  const page = pageParam.safeParse((await ctx.params).page);
  if (!page.success) return problem(400, "page must be a positive integer");
  const current = await pageForEdit(g.db, page.data, "ar");
  if (!current) return problem(404, "No lesson on that page");
  const b = await body(req, pageEdit);
  if (b.error) return b.error;
  const out = await savePage(g.db, current.lessonId, g.viewer.profileId, b.data);
  return out.ok ? privateJson(out) : problem(422, "Some items are not valid", out.errors);
}
