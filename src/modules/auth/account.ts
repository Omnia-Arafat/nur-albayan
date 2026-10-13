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

const nameOf = (meta?: Record<string, unknown>) => {
  const name = meta?.full_name ?? meta?.name;
  return typeof name === "string" && name.trim() ? name.trim().slice(0, 80) : undefined;
};

/**
 * The profile row for a Supabase user, created on first sign-in. A teacher signs up like anyone else and an admin
 * gives them the teacher role on the people page, so nobody can make themself staff.
 */
export async function ensureAccount(
  db: Db,
  user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> },
  locale: string,
) {
  const [found] = await db.select().from(s.profiles).where(eq(s.profiles.id, user.id));
  if (found) return found;
  const email = (user.email ?? "").toLowerCase();
  const [made] = await db
    .insert(s.profiles)
    .values({
      id: user.id,
      // Google and other providers give a name; an email-only account starts with the part before the @.
      displayName: nameOf(user.user_metadata) ?? (email.split("@")[0] || "reader"),
      locale,
      roleKey: adminEmails().includes(email) ? "admin" : "student",
    })
    .onConflictDoNothing()
    .returning();
  return made ?? (await db.select().from(s.profiles).where(eq(s.profiles.id, user.id)))[0];
}
