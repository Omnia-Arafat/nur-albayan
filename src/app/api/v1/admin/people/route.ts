import { guard, privateJson } from "@/lib/api";
import { listPeople } from "@/modules/people/service";

export async function GET(req: Request) {
  const g = await guard("users.manage");
  if (g.error) return g.error;
  return privateJson(await listPeople(g.db, new URL(req.url).searchParams.get("locale") ?? "ar"));
}
