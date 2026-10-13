import "server-only";

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";

import type { Db } from "@/db/client";
import * as s from "@/db/schema";
import { supabaseConfigured, supabaseServer } from "@/lib/supabase/server";

import { readStudentToken, STUDENT_COOKIE } from "./student-session";

/**
 * A signed-in staff member or student account. Learners without an account never have one.
 * A class student signed in with a PIN has no profile (no email account): profileId is empty and
 * studentId names their row; their role is always "student", so no staff route accepts them.
 */
export type Viewer = {
  profileId: string;
  studentId?: string;
  displayName: string;
  roleKey: string;
  permissions: string[];
};

export const LOCAL_SIGN_IN_COOKIE = "nb-local-profile";

/**
 * Local sign-in: on the local database (no Supabase yet) a developer picks one of the staff profiles
 * from scripts/dev-fixtures.ts. It is never on in production or against a real database.
 */
export const localSignIn = () =>
  (process.env.DATABASE_URL ?? "").startsWith("pglite:") && process.env.NODE_ENV !== "production";

/** The Supabase auth user id from the request's session cookies, if any. */
async function supabaseUserId(): Promise<string | null> {
  if (!supabaseConfigured()) return null;
  const { data } = await (await supabaseServer()).auth.getUser();
  return data.user?.id ?? null;
}

const permissionsOf = async (db: Db, roleKey: string) =>
  (
    await db
      .select({ key: s.rolePermissions.permissionKey })
      .from(s.rolePermissions)
      .where(eq(s.rolePermissions.roleKey, roleKey))
  ).map((r) => r.key);

async function pinStudent(db: Db): Promise<Viewer | null> {
  const id = readStudentToken((await cookies()).get(STUDENT_COOKIE)?.value);
  if (!id) return null;
  const [st] = await db.select().from(s.students).where(eq(s.students.id, id));
  if (!st) return null;
  return {
    profileId: "",
    studentId: st.id,
    displayName: st.displayName,
    roleKey: "student",
    permissions: await permissionsOf(db, "student"),
  };
}

export async function getViewer(db: Db): Promise<Viewer | null> {
  const id = localSignIn() ? ((await cookies()).get(LOCAL_SIGN_IN_COOKIE)?.value ?? null) : await supabaseUserId();
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) return pinStudent(db);
  const [p] = await db.select().from(s.profiles).where(eq(s.profiles.id, id));
  if (!p || p.status !== "active") return null;
  return {
    profileId: p.id,
    displayName: p.displayName,
    roleKey: p.roleKey,
    permissions: await permissionsOf(db, p.roleKey),
  };
}

export const can = (v: Viewer | null, permission: string) => Boolean(v?.permissions.includes(permission));
