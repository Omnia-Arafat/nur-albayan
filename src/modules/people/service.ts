import "server-only";

import { asc, count, eq } from "drizzle-orm";

import type { Db } from "@/db/client";
import * as s from "@/db/schema";

/** Every account with its role, for the admin's people page. */
export async function listPeople(db: Db, locale: string) {
  const [people, roles, labels, classes, students] = await Promise.all([
    db.select().from(s.profiles).orderBy(asc(s.profiles.displayName)),
    db.select().from(s.roles).orderBy(asc(s.roles.position)),
    db.select().from(s.rolesI18n),
    db
      .select({ teacherId: s.classrooms.ownerTeacherId, n: count() })
      .from(s.classrooms)
      .groupBy(s.classrooms.ownerTeacherId),
    db.select({ n: count() }).from(s.students),
  ]);
  const label = (key: string) =>
    labels.find((l) => l.entityKey === key && l.locale === locale)?.label ??
    labels.find((l) => l.entityKey === key)?.label ??
    key;
  return {
    roles: roles.map((r) => ({ key: r.key, label: label(r.key) })),
    studentCount: students[0]?.n ?? 0,
    people: people.map((p) => ({
      id: p.id,
      name: p.displayName,
      roleKey: p.roleKey,
      status: p.status,
      classrooms: classes.find((c) => c.teacherId === p.id)?.n ?? 0,
    })),
  };
}

export async function updatePerson(db: Db, id: string, change: { roleKey?: string; status?: "active" | "disabled" }) {
  if (change.roleKey) {
    const [role] = await db.select().from(s.roles).where(eq(s.roles.key, change.roleKey));
    if (!role) return { ok: false as const, error: "unknown role" };
  }
  const [row] = await db
    .update(s.profiles)
    .set({ ...change, updatedAt: new Date() })
    .where(eq(s.profiles.id, id))
    .returning();
  return row ? { ok: true as const } : { ok: false as const, error: "no such person" };
}
