import { cookies } from "next/headers";

import { privateJson } from "@/lib/api";
import { supabaseConfigured, supabaseServer } from "@/lib/supabase/server";
import { STUDENT_COOKIE } from "@/modules/auth/student-session";
import { LOCAL_SIGN_IN_COOKIE } from "@/modules/auth/viewer";

/** Signs out of every kind of session: Supabase, a class student's PIN session and the local sample account. */
export async function DELETE() {
  if (supabaseConfigured()) await (await supabaseServer()).auth.signOut();
  const jar = await cookies();
  jar.delete(LOCAL_SIGN_IN_COOKIE);
  jar.delete(STUDENT_COOKIE);
  return privateJson({ ok: true });
}
