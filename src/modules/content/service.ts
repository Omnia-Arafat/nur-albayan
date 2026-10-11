import { and, asc, eq, inArray, ne } from "drizzle-orm";

import type { Db } from "@/db/client";
import * as s from "@/db/schema";

export type LessonListItem = {
  slug: string;
  bookPage: number;
  status: string;
  title: string;
  subtitle: string | null;
  unitTag: string | null;
  lessonTag: string | null;
  stagePosition: number;
  stageTitle: string | null;
  stageTagToken: string | null;
  unitPosition: number;
  unitTitle: string | null;
};

export type Segment = { text: string; role: string; cellBreakAfter: boolean };
export type Item = {
  id: string;
  cardType: string;
  script: "naskh" | "uthmani";
  rowBand: number;
  isDrillable: boolean;
  searchText: string;
  segments: Segment[];
};
export type Section = {
  id: string;
  kind: string;
  config: Record<string, unknown>;
  label: string | null;
  title: string | null;
  paletteFills: string[];
  rowsPerColor: number;
  items: Item[];
};
export type Lesson = LessonListItem & { teacherNote: string | null; observeTag: string | null; sections: Section[] };

const pick = <T extends { locale: string }>(rows: T[], locale: string, fallback: string) =>
  rows.find((r) => r.locale === locale) ?? rows.find((r) => r.locale === fallback) ?? rows[0];

async function defaultLocale(db: Db) {
  const [l] = await db.select().from(s.locales).where(eq(s.locales.isDefault, true));
  return l?.code ?? "ar";
}

/** Every lesson (one per printed page) in book order, for the journey map. Archived pages are left out. */
export async function listLessons(db: Db, locale: string): Promise<LessonListItem[]> {
  const fb = await defaultLocale(db);
  const rows = await db
    .select({ lesson: s.lessons, unit: s.units, stage: s.stages })
    .from(s.lessons)
    .innerJoin(s.units, eq(s.units.id, s.lessons.unitId))
    .innerJoin(s.stages, eq(s.stages.id, s.units.stageId))
    .where(ne(s.lessons.status, "archived"))
    .orderBy(asc(s.lessons.bookPage));
  const ids = rows.map((r) => r.lesson.id);
  const unitIds = [...new Set(rows.map((r) => r.unit.id))];
  const stageIds = [...new Set(rows.map((r) => r.stage.id))];
  const sg = stageIds.length
    ? await db.select().from(s.stagesI18n).where(inArray(s.stagesI18n.entityId, stageIds))
    : [];
  const tr = ids.length ? await db.select().from(s.lessonsI18n).where(inArray(s.lessonsI18n.entityId, ids)) : [];
  const ut = unitIds.length ? await db.select().from(s.unitsI18n).where(inArray(s.unitsI18n.entityId, unitIds)) : [];
  return rows.map(({ lesson, unit, stage }) => {
    const t = pick(
      tr.filter((x) => x.entityId === lesson.id),
      locale,
      fb,
    );
    const u = pick(
      ut.filter((x) => x.entityId === unit.id),
      locale,
      fb,
    );
    const g = pick(
      sg.filter((x) => x.entityId === stage.id),
      locale,
      fb,
    );
    return {
      slug: lesson.slug,
      bookPage: lesson.bookPage,
      status: lesson.status,
      title: t?.title ?? lesson.slug,
      subtitle: t?.subtitle ?? null,
      unitTag: t?.unitTag ?? null,
      lessonTag: t?.lessonTag ?? null,
      stagePosition: stage.position,
      stageTitle: g?.title ?? null,
      stageTagToken: stage.tagTokenKey,
      unitPosition: unit.position,
      unitTitle: u?.title ?? null,
    };
  });
}

/** One printed page with its sections, items and coloured segments, in print order. */
export async function getLesson(db: Db, bookPage: number, locale: string): Promise<Lesson | null> {
  const fb = await defaultLocale(db);
  const list = await listLessons(db, locale);
  const head = list.find((l) => l.bookPage === bookPage);
  if (!head) return null;
  const [lesson] = await db.select().from(s.lessons).where(eq(s.lessons.bookPage, bookPage));
  const [t] = [pick(await db.select().from(s.lessonsI18n).where(eq(s.lessonsI18n.entityId, lesson.id)), locale, fb)];
  const sections = await db
    .select({ section: s.lessonSections, palette: s.pillPalettes })
    .from(s.lessonSections)
    .leftJoin(s.pillPalettes, eq(s.pillPalettes.id, s.lessonSections.pillPaletteId))
    .where(eq(s.lessonSections.lessonId, lesson.id))
    .orderBy(asc(s.lessonSections.position));
  const [defaultPalette] = await db.select().from(s.pillPalettes).where(eq(s.pillPalettes.isDefault, true));
  const sectionIds = sections.map((x) => x.section.id);
  const st = sectionIds.length
    ? await db.select().from(s.lessonSectionsI18n).where(inArray(s.lessonSectionsI18n.entityId, sectionIds))
    : [];
  const items = sectionIds.length
    ? await db.select().from(s.items).where(inArray(s.items.sectionId, sectionIds)).orderBy(asc(s.items.position))
    : [];
  const itemIds = items.map((i) => i.id);
  const segs = itemIds.length
    ? await db
        .select()
        .from(s.itemSegments)
        .where(and(inArray(s.itemSegments.itemId, itemIds)))
        .orderBy(asc(s.itemSegments.position))
    : [];
  return {
    ...head,
    teacherNote: t?.teacherNote ?? null,
    observeTag: t?.observeTag ?? null,
    sections: sections.map(({ section, palette }) => {
      const l = pick(
        st.filter((x) => x.entityId === section.id),
        locale,
        fb,
      );
      const pal = palette ?? defaultPalette;
      return {
        id: section.id,
        kind: section.kind,
        config: section.config as Record<string, unknown>,
        label: l?.label ?? null,
        title: l?.title ?? null,
        paletteFills: pal?.fillTokenKeys ?? [],
        rowsPerColor: pal?.rowsPerColor ?? 1,
        items: items
          .filter((i) => i.sectionId === section.id)
          .map((i) => ({
            id: i.id,
            cardType: i.cardTypeKey,
            script: i.script,
            rowBand: i.rowBand,
            isDrillable: i.isDrillable,
            searchText: i.searchText,
            segments: segs
              .filter((g) => g.itemId === i.id)
              .map((g) => ({ text: g.text, role: g.roleKey, cellBreakAfter: g.cellBreakAfter })),
          })),
      };
    }),
  };
}
