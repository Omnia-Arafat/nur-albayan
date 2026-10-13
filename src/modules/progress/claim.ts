import "server-only";

import { and, asc, eq, gte, inArray, isNotNull, sql, sum } from "drizzle-orm";

import type { Db } from "@/db/client";
import * as s from "@/db/schema";

import { dayKey, type LocalProfile, localProfile, streakOf } from "./local";

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
export async function claimDeviceProgress(
  db: Db,
  owner: { profileId: string } | { studentId: string },
  device: LocalProfile,
  today = new Date(),
) {
  const student =
    "studentId" in owner
      ? (await db.select().from(s.students).where(eq(s.students.id, owner.studentId)))[0]
      : await studentForAccount(db, owner.profileId, device.name);
  if (!student) throw new Error("No such student");
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

    // Game points live in the ledger under one row per device, replaced on each upload. A device that
    // synced already carries the other devices' points in its total, so its row holds only the rest.
    if (device.gamePoints > 0) {
      const ref = `device:${device.id}:games`;
      await tx.delete(s.xpLedger).where(and(eq(s.xpLedger.studentId, student.id), eq(s.xpLedger.refId, ref)));
      const [others] = await tx
        .select({ n: sum(s.xpLedger.amount) })
        .from(s.xpLedger)
        .where(and(eq(s.xpLedger.studentId, student.id), eq(s.xpLedger.source, "game")));
      const amount = device.link ? device.gamePoints - Number(others?.n ?? 0) : device.gamePoints;
      if (amount > 0) await tx.insert(s.xpLedger).values({ studentId: student.id, source: "game", amount, refId: ref });
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

/**
 * The account's progress in the device's shape, so a device can bring it in (mergeRemote): pages by
 * book page, banked words with their letters, badges, reading days and game points.
 */
export async function progressSnapshot(db: Db, studentId: string, today = new Date()): Promise<LocalProfile | null> {
  const [st] = await db.select().from(s.students).where(eq(s.students.id, studentId));
  if (!st) return null;
  const [records, words, badges, [games], [streak], readDays] = await Promise.all([
    db
      .select({ r: s.lessonRecords, page: s.lessons.bookPage })
      .from(s.lessonRecords)
      .innerJoin(s.lessons, eq(s.lessons.id, s.lessonRecords.lessonId))
      .where(eq(s.lessonRecords.studentId, studentId)),
    db
      .select({ m: s.mistakeBank, page: s.lessons.bookPage })
      .from(s.mistakeBank)
      .innerJoin(s.lessons, eq(s.lessons.id, s.mistakeBank.lessonId))
      .where(eq(s.mistakeBank.studentId, studentId)),
    db.select({ key: s.studentBadges.badgeKey }).from(s.studentBadges).where(eq(s.studentBadges.studentId, studentId)),
    db
      .select({ n: sum(s.xpLedger.amount) })
      .from(s.xpLedger)
      .where(and(eq(s.xpLedger.studentId, studentId), eq(s.xpLedger.source, "game"))),
    db.select().from(s.streaks).where(eq(s.streaks.studentId, studentId)),
    db
      .selectDistinct({ day: sql<string>`to_char(${s.sessions.finishedAt}, 'YYYY-MM-DD')` })
      .from(s.sessions)
      .where(
        and(
          eq(s.sessions.studentId, studentId),
          isNotNull(s.sessions.finishedAt),
          gte(s.sessions.finishedAt, new Date(today.getTime() - 400 * 86_400_000)),
        ),
      ),
  ]);
  const segs = words.length
    ? await db
        .select()
        .from(s.itemSegments)
        .where(
          inArray(
            s.itemSegments.itemId,
            words.map((w) => w.m.itemId),
          ),
        )
        .orderBy(asc(s.itemSegments.position))
    : [];
  // Days a device uploaded are kept only as the streak: count back from its last day.
  const days = new Set(readDays.map((d) => d.day));
  if (streak?.lastActiveDay)
    for (let i = 0; i < streak.current; i++) {
      const d = new Date(`${streak.lastActiveDay}T12:00:00`);
      d.setDate(d.getDate() - i);
      days.add(dayKey(d));
    }
  return localProfile.parse({
    id: st.deviceProfileId ?? st.id,
    name: st.displayName,
    avatar: { kind: "letter", value: Array.from(st.displayName)[0] ?? "" },
    colorTokenKey: "color.blue",
    createdAt: st.createdAt.toISOString(),
    records: Object.fromEntries(
      records.map(({ r, page }) => [
        String(page),
        {
          bestScore: r.bestScore,
          latestScore: r.latestScore,
          cumulativeScore: r.cumulativeScore,
          stars: r.stars,
          completedCount: r.completedCount,
        },
      ]),
    ),
    mistakes: Object.fromEntries(
      words.map(({ m, page }) => [
        m.itemId,
        {
          itemId: m.itemId,
          bookPage: page,
          segments: segs.filter((g) => g.itemId === m.itemId).map((g) => ({ text: g.text, role: g.roleKey })),
          missCount: m.missCount,
          correctStreak: m.correctStreak,
          mastered: m.masteredAt !== null,
          updatedAt: (m.masteredAt ?? m.lastMissedAt ?? st.createdAt).toISOString(),
        },
      ]),
    ),
    badges: badges.map((b) => b.key),
    days: [...days].sort(),
    gamePoints: Number(games?.n ?? 0),
  });
}
