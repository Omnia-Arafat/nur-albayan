import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import type { Db } from "@/db/client";
import * as s from "@/db/schema";
import { formatItem, parseItem, scriptOf, stripTashkeel } from "@/modules/book/item-dsl";

import { getLesson } from "./service";

/** A lesson page as the editor shows it: every item written in the book source format. */
export async function pageForEdit(db: Db, page: number, locale: string) {
  const lesson = await getLesson(db, page, locale);
  if (!lesson) return null;
  const [row] = await db.select().from(s.lessons).where(eq(s.lessons.bookPage, page));
  const i18n = await db.select().from(s.lessonsI18n).where(eq(s.lessonsI18n.entityId, row.id));
  return {
    lessonId: row.id,
    bookPage: page,
    status: row.status,
    version: row.version,
    hasScan: Boolean(row.scanAssetId),
    i18n: Object.fromEntries(
      i18n.map((t) => [t.locale, { title: t.title, subtitle: t.subtitle, teacherNote: t.teacherNote }]),
    ),
    // Sections as the reader gets them, plus each item written in the book source format.
    sections: lesson.sections.map((sec) => ({
      ...sec,
      items: sec.items.map((i) => ({ ...i, source: formatItem(i.cardType, i.segments) })),
    })),
  };
}

export const pageEdit = z.object({
  status: z.enum(s.contentStatus.enumValues).optional(),
  i18n: z
    .record(
      z.string(),
      z.object({
        title: z.string().trim().min(1).max(200),
        subtitle: z.string().trim().max(300).nullable().optional(),
        teacherNote: z.string().trim().max(4000).nullable().optional(),
      }),
    )
    .optional(),
  items: z
    .array(z.object({ id: z.uuid(), source: z.string().trim().min(1).max(500) }))
    .max(500)
    .optional(),
});
export type PageEdit = z.infer<typeof pageEdit>;

/** Parse an item's source; returns the parsed item or the reason it is not valid. */
export function checkItem(source: string) {
  try {
    return { ok: true as const, item: parseItem(source) };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}

/**
 * Save an editor's changes to one page. Items keep their ids (attempts and mistake banks point at them);
 * only their segments, card type, script and search text are rewritten. Every change is kept in content_revisions.
 */
export async function savePage(db: Db, lessonId: string, authorId: string, edit: PageEdit) {
  const parsed = (edit.items ?? []).map((i) => ({ ...i, check: checkItem(i.source) }));
  const bad = parsed.filter((p) => !p.check.ok);
  if (bad.length)
    return { ok: false as const, errors: bad.map((b) => ({ id: b.id, error: (b.check as { error: string }).error })) };

  return db.transaction(async (tx) => {
    const [lesson] = await tx.select().from(s.lessons).where(eq(s.lessons.id, lessonId));
    if (!lesson) return { ok: false as const, errors: [{ id: lessonId, error: "no such lesson" }] };
    const diff: Record<string, unknown> = {};

    if (edit.i18n) {
      for (const [locale, t] of Object.entries(edit.i18n)) {
        const key = and(eq(s.lessonsI18n.entityId, lessonId), eq(s.lessonsI18n.locale, locale));
        const [prev] = await tx.select().from(s.lessonsI18n).where(key);
        const values = { title: t.title, subtitle: t.subtitle || null, teacherNote: t.teacherNote || null };
        if (prev) await tx.update(s.lessonsI18n).set(values).where(key);
        else await tx.insert(s.lessonsI18n).values({ entityId: lessonId, locale, ...values });
        diff[`i18n.${locale}`] = {
          before: prev ? { title: prev.title, subtitle: prev.subtitle, teacherNote: prev.teacherNote } : null,
          after: values,
        };
      }
    }

    if (parsed.length) {
      const ids = parsed.map((p) => p.id);
      // Only items of this lesson may be edited through it.
      const own = await tx
        .select({ id: s.items.id, script: s.items.script })
        .from(s.items)
        .innerJoin(s.lessonSections, eq(s.lessonSections.id, s.items.sectionId))
        .where(and(inArray(s.items.id, ids), eq(s.lessonSections.lessonId, lessonId)));
      const allowed = new Map(own.map((o) => [o.id, o]));
      const changed: unknown[] = [];
      for (const p of parsed) {
        const cur = allowed.get(p.id);
        if (!cur || !p.check.ok) continue;
        const { cardType, segments } = p.check.item;
        const before = await tx.select().from(s.itemSegments).where(eq(s.itemSegments.itemId, p.id));
        await tx.delete(s.itemSegments).where(eq(s.itemSegments.itemId, p.id));
        await tx
          .insert(s.itemSegments)
          .values(
            segments.map((seg, i) => ({
              itemId: p.id,
              position: i,
              text: seg.text,
              roleKey: seg.role,
              cellBreakAfter: Boolean(seg.cellBreakAfter),
            })),
          );
        await tx
          .update(s.items)
          .set({
            cardTypeKey: cardType,
            script: scriptOf(segments, cur.script),
            searchText: stripTashkeel(segments.map((g) => g.text).join("")),
            updatedAt: new Date(),
          })
          .where(eq(s.items.id, p.id));
        changed.push({ id: p.id, before: before.map((b) => ({ text: b.text, role: b.roleKey })), after: segments });
      }
      if (changed.length) diff.items = changed;
    }

    const status = edit.status ?? lesson.status;
    if (status !== lesson.status) diff.status = { before: lesson.status, after: status };
    const touched = Object.keys(diff).length > 0;
    if (touched) {
      await tx
        .update(s.lessons)
        .set({
          status,
          version: lesson.version + 1,
          publishedAt: status === "published" ? new Date() : lesson.publishedAt,
          updatedAt: new Date(),
        })
        .where(eq(s.lessons.id, lessonId));
      await tx.insert(s.contentRevisions).values({ entityTable: "lessons", entityId: lessonId, diff, authorId });
    }
    return { ok: true as const, changed: touched, version: touched ? lesson.version + 1 : lesson.version };
  });
}
