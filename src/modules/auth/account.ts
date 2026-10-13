import "server-only";

import { eq } from "drizzle-orm";

import type { Db } from "@/db/client";
import * as s from "@/db/schema";

/** Emails that become admins on their first sign-in (ADMIN_EMAILS, comma separated). Everyone else starts as a student. */
const adminEmails = () =>
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

/**
 * The profile row for a Supabase user, created on first sign-in. A teacher signs up like anyone else and an admin
 * gives them the teacher role on the people page, so nobody can make themself staff.
 */
export async function ensureAccount(db: Db, user: { id: string; email?: string | null }, locale: string) {
  const [found] = await db.select().from(s.profiles).where(eq(s.profiles.id, user.id));
  if (found) return found;
  const email = (user.email ?? "").toLowerCase();
  const [made] = await db
    .insert(s.profiles)
    .values({
      id: user.id,
      displayName: email.split("@")[0] || "reader",
      locale,
      roleKey: adminEmails().includes(email) ? "admin" : "student",
    })
    .onConflictDoNothing()
    .returning();
  return made ?? (await db.select().from(s.profiles).where(eq(s.profiles.id, user.id)))[0];
}
