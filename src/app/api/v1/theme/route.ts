import { getDb } from "@/db/client";
import { getTheme } from "@/modules/theme/service";

/** The default theme as a stylesheet: tokens, fonts, teaching roles and the motion system. */
export async function GET() {
  const { css } = await getTheme(await getDb());
  return new Response(css, {
    headers: { "content-type": "text/css; charset=utf-8", "cache-control": "public, max-age=300" },
  });
}
