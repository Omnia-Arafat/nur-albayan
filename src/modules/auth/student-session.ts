import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";

import type { Db } from "@/db/client";
import * as s from "@/db/schema";
import { checkPin } from "@/modules/classroom/service";

/**
 * Sign-in for students a teacher added with a username and PIN. They have no email, so no Supabase
 * account: the session is a signed cookie naming the student row. It needs AUTH_SECRET; on the
 * local database a fixed development secret stands in, so the flow can be tried without one.
 */
export const STUDENT_COOKIE = "nb-student";
const DAYS = 30;

function secret() {
  const set = process.env.AUTH_SECRET;
  if (set && set.length >= 32) return set;
  const local = (process.env.DATABASE_URL ?? "").startsWith("pglite:") && process.env.NODE_ENV !== "production";
  return local ? "local-development-only-secret-not-for-production" : null;
}

export const studentSignInReady = () => secret() !== null;

const sign = (body: string, key: string) => createHmac("sha256", key).update(body).digest("base64url");

export function studentToken(studentId: string, now = Date.now()) {
  const key = secret();
  if (!key) throw new Error("AUTH_SECRET is not set");
  const body = `${studentId}.${now + DAYS * 864e5}`;
  return { value: `${body}.${sign(body, key)}`, maxAge: DAYS * 86400 };
}

/** The student id in a valid, unexpired token, or null. */
export function readStudentToken(token: string | undefined, now = Date.now()): string | null {
  const key = secret();
  if (!key || !token) return null;
  const [id, exp, sig] = token.split(".");
  if (!id || !exp || !sig || Number(exp) < now) return null;
  const want = Buffer.from(sign(`${id}.${exp}`, key));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got) && /^[0-9a-f-]{36}$/.test(id) ? id : null;
}

// Wrong PINs per class and username: a short lock after a few misses, per server instance.
const misses = new Map<string, { n: number; until: number }>();
const MAX_MISSES = 5;
const LOCK_MS = 5 * 60_000;

export type PinResult = { ok: true; studentId: string } | { ok: false; reason: "wrong" | "locked" };

/** Checks a class code, username and PIN. The same answer for an unknown class, user or PIN. */
export async function checkStudentPin(
  db: Db,
  input: { joinCode: string; username: string; pin: string },
  now = Date.now(),
): Promise<PinResult> {
  const key = `${input.joinCode.toUpperCase()}:${input.username.toLowerCase()}`;
  const m = misses.get(key);
  if (m && m.n >= MAX_MISSES && m.until > now) return { ok: false, reason: "locked" };
  const [row] = await db
    .select({ id: s.students.id, pinHash: s.students.pinHash })
    .from(s.students)
    .innerJoin(s.classroomMembers, eq(s.classroomMembers.studentId, s.students.id))
    .innerJoin(s.classrooms, eq(s.classrooms.id, s.classroomMembers.classroomId))
    .where(
      and(
        sql`upper(${s.classrooms.joinCode}) = ${input.joinCode.toUpperCase()}`,
        sql`lower(${s.students.username}) = ${input.username.toLowerCase()}`,
      ),
    );
  if (row?.pinHash && checkPin(input.pin, row.pinHash)) {
    misses.delete(key);
    return { ok: true, studentId: row.id };
  }
  const n = (m && m.until > now ? m.n : 0) + 1;
  misses.set(key, { n, until: now + LOCK_MS });
  return { ok: false, reason: n >= MAX_MISSES ? "locked" : "wrong" };
}
