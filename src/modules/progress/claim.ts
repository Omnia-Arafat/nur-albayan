import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";

import type { Db } from "@/db/client";
import * as s from "@/db/schema";

import { dayKey, type LocalProfile, streakOf } from "./local";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The student row that belongs to an account, created on first use from the device profile's name. */
export async function studentForAccount(db: Db, profileId: string, fallbackName: string) {
  const [found] = await db.select().from(s.students).where(eq(s.students.profileId, profileId));
  if (found) return found;
  const [made] = await db
    .insert(s.students)
    .values({ profileId, displayName: fallbackName, useFirstLetter: true })
    .returning();
  return made;
}

/**
 * Copy a device profile's progress into the signed-in account. Merging only ever keeps the better value
 * (stars, best score, counts), so uploading the same device twice, or two devices, loses nothing.
 */
export async function claimDeviceProgress(db: Db, profileId: string, device: LocalProfile, today = new Date()) {
  const student = await studentForAccount(db, profileId, device.name);
  return db.transaction(async (tx) => {
    if (!student.deviceProfileId) {
      const [taken] = await tx
        .select({ id: s.students.id })
        .from(s.students)
        .where(eq(s.students.deviceProfileId, device.id));
      if (!taken)
        await tx
          .update(s.students)
          .set({ deviceProfileId: device.id, claimedAt: today })
          .where(eq(s.students.id, student.id));
    }

    const pages = Object.keys(device.records).map(Number).filter(Number.isInteger);
    const lessons = pages.length
      ? await tx
          .select({ id: s.lessons.id, page: s.lessons.bookPage })
          .from(s.lessons)
          .where(inArray(s.lessons.bookPage, pages))
      : [];
    let records = 0;
    for (const l of lessons) {
      const r = device.records[String(l.page)];
      if (!r) continue;
      await tx
        .insert(s.lessonRecords)
        .values({ studentId: student.id, lessonId: l.id, ...r, lastStudiedAt: today })
        .onConflictDoUpdate({
          target: [s.lessonRecords.studentId, s.lessonRecords.lessonId],
          set: {
            bestScore: sql`greatest(${s.lessonRecords.bestScore}, excluded.best_score)`,
            cumulativeScore: sql`greatest(${s.lessonRecords.cumulativeScore}, excluded.cumulative_score)`,
            stars: sql`greatest(${s.lessonRecords.stars}, excluded.stars)`,
            completedCount: sql`greatest(${s.lessonRecords.completedCount}, excluded.completed_count)`,
          },
        });
      records++;
    }

    // Ids come from the device, so skip any that are not item ids rather than failing the whole upload.
    const mistakes = Object.values(device.mistakes).filter((m) => uuid.test(m.itemId));
    const known = mistakes.length
      ? await tx
          .select({ id: s.items.id, lessonId: s.lessonSections.lessonId })
          .from(s.items)
          .innerJoin(s.lessonSections, eq(s.lessonSections.id, s.items.sectionId))
          .where(
            inArray(
              s.items.id,
              mistakes.map((m) => m.itemId),
            ),
          )
      : [];
    const lessonOf = new Map(known.map((k) => [k.id, k.lessonId]));
    let words = 0;
    for (const m of mistakes) {
      const lessonId = lessonOf.get(m.itemId);
      if (!lessonId) continue;
      await tx
        .insert(s.mistakeBank)
        .values({
          studentId: student.id,
          itemId: m.itemId,
          lessonId,
          missCount: m.missCount,
          correctStreak: m.correctStreak,
          lastMissedAt: new Date(m.updatedAt),
          masteredAt: m.mastered ? new Date(m.updatedAt) : null,
        })
        .onConflictDoUpdate({
          target: [s.mistakeBank.studentId, s.mistakeBank.itemId],
          set: {
            missCount: sql`greatest(${s.mistakeBank.missCount}, excluded.miss_count)`,
            masteredAt: sql`coalesce(${s.mistakeBank.masteredAt}, excluded.mastered_at)`,
          },
        });
      words++;
    }

    if (device.badges.length) {
      const exist = await tx.select({ key: s.badges.key }).from(s.badges).where(inArray(s.badges.key, device.badges));
      if (exist.length)
        await tx
          .insert(s.studentBadges)
          .values(exist.map((b) => ({ studentId: student.id, badgeKey: b.key })))
          .onConflictDoNothing();
    }

    // Game points live in the ledger under one row per device, replaced on each upload.
    if (device.gamePoints > 0) {
      const ref = `device:${device.id}:games`;
      await tx.delete(s.xpLedger).where(and(eq(s.xpLedger.studentId, student.id), eq(s.xpLedger.refId, ref)));
      await tx
        .insert(s.xpLedger)
        .values({ studentId: student.id, source: "game", amount: device.gamePoints, refId: ref });
    }

    const current = streakOf(device, today);
    const last = [...device.days].sort().at(-1) ?? null;
    if (last) {
      const [st] = await tx.select().from(s.streaks).where(eq(s.streaks.studentId, student.id));
      const values = {
        current: st && st.lastActiveDay && st.lastActiveDay >= last ? st.current : current,
        longest: Math.max(st?.longest ?? 0, current),
        lastActiveDay: st?.lastActiveDay && st.lastActiveDay > last ? st.lastActiveDay : last,
      };
      if (st) await tx.update(s.streaks).set(values).where(eq(s.streaks.studentId, student.id));
      else await tx.insert(s.streaks).values({ studentId: student.id, ...values });
    }

    return { studentId: student.id, records, words, badges: device.badges.length, day: dayKey(today) };
  });
}
