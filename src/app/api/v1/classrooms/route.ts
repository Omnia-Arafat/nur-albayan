import { z } from "zod";

import { body, guard, privateJson } from "@/lib/api";
import { createClassroom, listClassrooms } from "@/modules/classroom/service";

export async function GET() {
  const g = await guard("classrooms.manage");
  if (g.error) return g.error;
  return privateJson(await listClassrooms(g.db, g.viewer));
}

/** A teacher opens a new class. */
export async function POST(req: Request) {
  const g = await guard("classrooms.manage");
  if (g.error) return g.error;
  const b = await body(req, z.object({ name: z.string().trim().min(1).max(60) }));
  if (b.error) return b.error;
  const room = await createClassroom(g.db, g.viewer.profileId, b.data.name);
  return privateJson({ id: room.id, joinCode: room.joinCode }, 201);
}
