import { getDb } from "@/db/client";
import { getLocales } from "@/modules/i18n/service";

/** "/" opens the app in the default locale. */
export async function GET(req: Request) {
  const all = await getLocales(await getDb());
  const code = all.find((l) => l.isDefault)?.code ?? all[0]?.code;
  return Response.redirect(new URL(`/${code}`, req.url), 307);
}
