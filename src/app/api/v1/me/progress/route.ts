import { body, guard, privateJson } from "@/lib/api";
import { claimDeviceProgress } from "@/modules/progress/claim";
import { localProfile } from "@/modules/progress/local";

/** Uploads one device profile's progress into the signed-in account (safe to repeat). */
export async function POST(req: Request) {
  const g = await guard("progress.own");
  if (g.error) return g.error;
  const b = await body(req, localProfile);
  if (b.error) return b.error;
  return privateJson(await claimDeviceProgress(g.db, g.viewer.profileId, b.data));
}
