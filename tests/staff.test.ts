import { PGlite } from "@electric-sql/pglite";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, describe, expect, it, vi } from "vitest";

import type { Db } from "@/db/client";
import * as s from "@/db/schema";
import { loadContent, runContentSeed } from "@/db/seed/content";
import { loadSeed } from "@/db/seed/files";
import { runSeed } from "@/db/seed/run";

vi.mock("server-only", () => ({}));

const { recordSession } = await import("@/modules/progress/server");
const { pageForEdit, savePage } = await import("@/modules/content/editor");
const { setSetting, settingsAt } = await import("@/modules/settings/service");
const { addStudent, classroomOverview } = await import("@/modules/classroom/service");
const { claimDeviceProgress } = await import("@/modules/progress/claim");
const { newProfile } = await import("@/modules/progress/local");

const seed = loadSeed();
let db: Db;
let teacherId: string;
let classroomId: string;
let studentId: string;
let lesson: NonNullable<Awaited<ReturnType<typeof pageForEdit>>>;

beforeAll(async () => {
  db = drizzle(new PGlite(), { schema: s }) as unknown as Db;
  await migrate(db as never, { migrationsFolder: "db/migrations" });
  await runSeed(db as never, seed);
  await runContentSeed(db as never, loadContent());
  teacherId = crypto.randomUUID();
  await db.insert(s.profiles).values({ id: teacherId, displayName: "T", roleKey: "teacher" });
  [{ id: classroomId }] = await db
    .insert(s.classrooms)
    .values({ ownerTeacherId: teacherId, name: "C", joinCode: "TEST01" })
    .returning();
  ({ id: studentId } = await addStudent(db, { classroomId, teacherId, displayName: "S", username: "s1", pin: "1234" }));
  lesson = (await pageForEdit(db, 41, "ar"))!;
}, 120_000);

const drillable = () => lesson.sections.flatMap((x) => x.items.filter((i) => i.isDrillable));

describe("teacher grading on the server", () => {
  it("stores a session once, with the lesson record and mistake bank", async () => {
    const items = drillable();
    const reads = items.map((i, k) => ({ itemId: i.id, result: k === 0 ? ("wrong" as const) : ("correct" as const) }));
    const input = {
      studentId,
      lessonId: lesson.lessonId,
      reads,
      gradedBy: "teacher" as const,
      graderProfileId: teacherId,
      clientSessionId: "test-session-1",
    };
    const first = await recordSession(db, input);
    expect(first.duplicate).toBe(false);
    expect((await recordSession(db, input)).duplicate).toBe(true);

    const [rec] = await db.select().from(s.lessonRecords).where(eq(s.lessonRecords.studentId, studentId));
    expect(rec.completedCount).toBe(1);
    expect(rec.stars).toBeGreaterThan(0);
    const bank = await db.select().from(s.mistakeBank).where(eq(s.mistakeBank.studentId, studentId));
    expect(bank.map((b) => b.itemId)).toEqual([items[0].id]);
    const att = await db.select().from(s.attempts);
    expect(att).toHaveLength(items.length);
    expect(att.every((a) => a.gradedBy === "teacher" && a.graderProfileId === teacherId)).toBe(true);

    const ov = (await classroomOverview(db, classroomId))!;
    expect(ov.students[0].bankCount).toBe(1);
    expect(ov.hardest[0].itemId).toBe(items[0].id);
  });
});

describe("content editor", () => {
  it("rejects an item that does not parse and changes nothing", async () => {
    const id = drillable()[1].id;
    const out = await savePage(db, lesson.lessonId, teacherId, { items: [{ id, source: "[open" }] });
    expect(out.ok).toBe(false);
    expect((await pageForEdit(db, 41, "ar"))!.version).toBe(lesson.version);
  });

  it("rewrites an item's segments in place, bumps the version and keeps a revision", async () => {
    const item = drillable()[1];
    const out = await savePage(db, lesson.lessonId, teacherId, { items: [{ id: item.id, source: "[بَ]{تَ}" }] });
    expect(out).toMatchObject({ ok: true, changed: true, version: lesson.version + 1 });
    const segs = await db.select().from(s.itemSegments).where(eq(s.itemSegments.itemId, item.id));
    expect(segs.map((g) => [g.text, g.roleKey])).toEqual([
      ["بَ", "target"],
      ["تَ", "contrast"],
    ]);
    const revs = await db.select().from(s.contentRevisions).where(eq(s.contentRevisions.entityId, lesson.lessonId));
    expect(revs).toHaveLength(1);
  });
});

describe("settings", () => {
  it("checks scope, type and limits before saving", async () => {
    expect((await setSetting(db, "classroom", classroomId, "gamification.xpPerLesson", 5)).ok).toBe(false);
    expect((await setSetting(db, "platform", null, "sound.enabled", "yes")).ok).toBe(false);
    expect((await setSetting(db, "classroom", classroomId, "games.breaksEnabled", false)).ok).toBe(true);
    expect((await setSetting(db, "classroom", classroomId, "games.breaksEnabled", true)).ok).toBe(true);
    const rows = await db
      .select()
      .from(s.settings)
      .where(and(eq(s.settings.scopeId, classroomId), eq(s.settings.key, "games.breaksEnabled")));
    expect(rows.map((r) => r.value)).toEqual([true]);
    const at = await settingsAt(db, "classroom", classroomId);
    expect(at.find((x) => x.key === "games.breaksEnabled")).toMatchObject({ value: true, isSet: true });
  });

  it("has a label for every setting and every option", () => {
    for (const l of seed.locales.map((x) => x.code)) {
      const app = seed.uiMessages[l].app;
      const missing = seed.settings.flatMap((d) => [
        ...(app[`setting.${d.key}`] ? [] : [`setting.${d.key}`]),
        ...(app[`setting.group.${d.group}`] ? [] : [`setting.group.${d.group}`]),
        ...(d.options ?? []).filter((o) => !app[`option.${o}`]).map((o) => `option.${o}`),
      ]);
      expect(missing).toEqual([]);
    }
  });
});

describe("uploading device progress to an account", () => {
  it("merges keeping the better values, and is safe to repeat", async () => {
    const accountId = crypto.randomUUID();
    await db.insert(s.profiles).values({ id: accountId, displayName: "A", roleKey: "student" });
    const [badge] = await db.select({ key: s.badges.key }).from(s.badges).limit(1);
    const item = drillable()[0];
    const today = new Date(2026, 9, 13);
    const device = {
      ...newProfile("device-1", "Lina", { kind: "letter", value: "L" }, "color.pill.sky.fill", today),
      records: { "41": { bestScore: 80, latestScore: 80, cumulativeScore: 80, stars: 2, completedCount: 1 } },
      mistakes: {
        [item.id]: {
          itemId: item.id,
          bookPage: 41,
          segments: [],
          missCount: 3,
          correctStreak: 0,
          mastered: false,
          updatedAt: today.toISOString(),
        },
        old: {
          itemId: "old",
          bookPage: 41,
          segments: [],
          missCount: 1,
          correctStreak: 0,
          mastered: false,
          updatedAt: "",
        },
      },
      badges: [badge.key, "not-a-badge"],
      days: ["2026-10-12", "2026-10-13"],
      gamePoints: 40,
    };

    const first = await claimDeviceProgress(db, accountId, device, today);
    expect(first).toMatchObject({ records: 1, words: 1 });
    const worse = {
      ...device,
      records: { "41": { ...device.records["41"], bestScore: 50, stars: 1 } },
      gamePoints: 55,
    };
    const again = await claimDeviceProgress(db, accountId, worse, today);
    expect(again.studentId).toBe(first.studentId);

    const [rec] = await db.select().from(s.lessonRecords).where(eq(s.lessonRecords.studentId, first.studentId));
    expect(rec).toMatchObject({ bestScore: 80, stars: 2 });
    const [student] = await db.select().from(s.students).where(eq(s.students.id, first.studentId));
    expect(student.deviceProfileId).toBe("device-1");
    expect(await db.select().from(s.studentBadges).where(eq(s.studentBadges.studentId, first.studentId))).toHaveLength(
      1,
    );
    const xp = await db.select().from(s.xpLedger).where(eq(s.xpLedger.studentId, first.studentId));
    expect(xp.map((x) => x.amount)).toEqual([55]);
    const [streak] = await db.select().from(s.streaks).where(eq(s.streaks.studentId, first.studentId));
    expect(streak).toMatchObject({ current: 2, lastActiveDay: "2026-10-13" });
  });
});
