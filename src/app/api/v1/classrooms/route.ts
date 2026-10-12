import { guard, privateJson } from "@/lib/api";
import { listClassrooms } from "@/modules/classroom/service";

export async function GET() {
  const g = await guard("classrooms.manage");
  if (g.error) return g.error;
  return privateJson(await listClassrooms(g.db, g.viewer));
}
