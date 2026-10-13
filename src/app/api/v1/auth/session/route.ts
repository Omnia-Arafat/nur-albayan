import { cookies } from "next/headers";

import { privateJson } from "@/lib/api";
import { supabaseConfigured, supabaseServer } from "@/lib/supabase/server";
import { LOCAL_SIGN_IN_COOKIE } from "@/modules/auth/viewer";

/** Signs out of both the Supabase session and the local sample-account cookie. */
export async function DELETE() {
  if (supabaseConfigured()) await (await supabaseServer()).auth.signOut();
  (await cookies()).delete(LOCAL_SIGN_IN_COOKIE);
  return privateJson({ ok: true });
}
