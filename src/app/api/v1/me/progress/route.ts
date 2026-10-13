import { eq } from "drizzle-orm";

import * as s from "@/db/schema";
import { body, guard, privateJson } from "@/lib/api";
import { claimDeviceProgress, progressSnapshot } from "@/modules/progress/claim";
import { localProfile } from "@/modules/progress/local";

/** The signed-in learner's progress as the account holds it, for a device to bring in. */
export async function GET() {
  const g = await guard("progress.own");
  if (g.error) return g.error;
  const studentId =
    g.viewer.studentId ??
    (await g.db.select({ id: s.students.id }).from(s.students).where(eq(s.students.profileId, g.viewer.profileId)))[0]
      ?.id;
  return privateJson({
    studentId: studentId ?? null,
    profile: studentId ? await progressSnapshot(g.db, studentId) : null,
  });
}

/** Uploads one device profile's progress into the signed-in account (safe to repeat). */
export async function POST(req: Request) {
  const g = await guard("progress.own");
  if (g.error) return g.error;
  const b = await body(req, localProfile);
  if (b.error) return b.error;
  const owner = g.viewer.studentId ? { studentId: g.viewer.studentId } : { profileId: g.viewer.profileId };
  return privateJson(await claimDeviceProgress(g.db, owner, b.data));
}
