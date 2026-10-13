import { eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { privateJson } from "@/lib/api";
import { supabaseConfigured } from "@/lib/supabase/server";
import { socialProviders } from "@/modules/auth/redirect";
import { studentSignInReady } from "@/modules/auth/student-session";
import { getViewer, localSignIn } from "@/modules/auth/viewer";

/** Who is signed in (if anyone) and which sign-in methods this site offers. */
export async function GET() {
  const db = await getDb();
  const viewer = await getViewer(db);
  const [student] = viewer
    ? await db
        .select({ id: s.students.id, claimedAt: s.students.claimedAt })
        .from(s.students)
        .where(viewer.studentId ? eq(s.students.id, viewer.studentId) : eq(s.students.profileId, viewer.profileId))
    : [];
  return privateJson({
    viewer: viewer && {
      name: viewer.displayName,
      roleKey: viewer.roleKey,
      staff: viewer.permissions.includes("reports.view"),
    },
    student: student ?? null,
    methods: {
      email: supabaseConfigured(),
      local: localSignIn(),
      social: supabaseConfigured() ? socialProviders() : [],
      student: studentSignInReady(),
    },
  });
}
