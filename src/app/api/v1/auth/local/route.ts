import { cookies } from "next/headers";
import { z } from "zod";

import { body, privateJson, problem } from "@/lib/api";
import { LOCAL_SIGN_IN_COOKIE, localSignIn } from "@/modules/auth/viewer";

/** Local database only: sign in as one of the sample staff profiles (scripts/dev-fixtures.ts). */
export async function POST(req: Request) {
  if (!localSignIn()) return problem(404, "Not available");
  const b = await body(req, z.object({ profileId: z.uuid() }));
  if (b.error) return b.error;
  (await cookies()).set(LOCAL_SIGN_IN_COOKIE, b.data.profileId, { httpOnly: true, sameSite: "lax", path: "/" });
  return privateJson({ ok: true });
}

export async function DELETE() {
  (await cookies()).delete(LOCAL_SIGN_IN_COOKIE);
  return privateJson({ ok: true });
}
