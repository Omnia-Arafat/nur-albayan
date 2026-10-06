import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { eq, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { z } from "zod";

import * as s from "../schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = PgDatabase<PgQueryResultHKT, any>;

const i18n = <T extends z.ZodRawShape>(shape: T) => z.record(z.string(), z.object(shape));

export const contentSegment = z.object({
  text: z.string().min(1),
  role: z.string(),
  cellBreakAfter: z.boolean().optional(),
});
export type ContentSegment = z.infer<typeof contentSegment>;

export const ruleExamplePart = z.union([
  z.object({ text: z.string(), role: z.string() }),
  z.object({ op: z.enum(["plus", "equals", "arrow", "dash", "dot", "compare"]) }),
]);
export type RuleExamplePart = { text: string; role: string; op?: never } | { op: "plus" | "equals" | "arrow" | "dash" | "dot" | "compare" };

const contentItem = z.object({
  cardType: z.string(),
  script: z.enum(["naskh", "uthmani"]),
  rowBand: z.number().int().min(0),
  searchText: z.string(),
  segments: z.array(contentSegment).min(1),
});

export const contentLesson = z.object({
  slug: z.string(),
  bookPage: z.number().int(),
  stage: z.string(),
  status: z.enum(["draft", "review", "published", "archived"]),
  i18n: i18n({ title: z.string().min(1), subtitle: z.string().optional(), teacherNote: z.string().optional() }),
  sections: z.array(
    z.object({
      kind: z.enum(["letter_tiles", "picture_grid", "segmented_rows", "word_rows", "sentences", "story", "rule_table", "rule_definition"]),
      config: z.record(z.string(), z.unknown()).optional(),
      items: z.array(contentItem),
    }),
  ),
  rules: z.array(z.object({ example: z.array(ruleExamplePart), i18n: i18n({ title: z.string(), description: z.string() }) })),
  games: z.record(z.string(), z.object({ enabled: z.boolean().optional(), config: z.record(z.string(), z.unknown()).optional() })),
  source: z.string().optional(),
});
export type ContentLesson = z.infer<typeof contentLesson>;

export const contentBook = z.object({
  slug: z.string(),
  edition: z.string().optional(),
  i18n: i18n({ title: z.string(), subtitle: z.string().optional() }),
  stages: z.array(z.object({ slug: z.string(), position: z.number().int(), i18n: i18n({ title: z.string() }) })),
});
export type ContentBook = z.infer<typeof contentBook>;

export type ContentSeed = { book: ContentBook; lessons: ContentLesson[] };

export function loadContent(dir = join(process.cwd(), "seed", "content")): ContentSeed {
  const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));
  const book = contentBook.parse(read(join(dir, "book.json")));
  const lessons = readdirSync(join(dir, "pages"))
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => {
      const parsed = contentLesson.safeParse(read(join(dir, "pages", f)));
      if (!parsed.success) throw new Error(`seed/content/pages/${f}: ${z.prettifyError(parsed.error)}`);
      return parsed.data;
    });
  return { book, lessons };
}

const i18nRows = <T extends Record<string, unknown>>(entityId: string, tr: Record<string, T>) =>
  Object.entries(tr).map(([locale, fields]) => ({ entityId, locale, ...fields }));

/**
 * Load the book's curriculum. A lesson whose slug already exists is skipped entirely,
 * so re-running never overwrites what editors changed in the admin panel.
 * One unit per stage for now; editors split stages into the book's units.
 */
export async function runContentSeed(db: AnyDb, content: ContentSeed) {
  await db.transaction(async (tx) => {
    const { book } = content;
    let [bookRow] = await tx.select({ id: s.books.id }).from(s.books).where(eq(s.books.slug, book.slug));
    if (!bookRow) {
      [bookRow] = await tx.insert(s.books).values({ slug: book.slug, edition: book.edition }).returning({ id: s.books.id });
      await tx.insert(s.booksI18n).values(i18nRows(bookRow.id, book.i18n));
    }

    const unitOfStage = new Map<string, string>();
    for (const stage of book.stages) {
      let [stageRow] = await tx
        .select({ id: s.stages.id })
        .from(s.stages)
        .where(sql`${s.stages.bookId} = ${bookRow.id} and ${s.stages.position} = ${stage.position}`);
      if (!stageRow) {
        [stageRow] = await tx.insert(s.stages).values({ bookId: bookRow.id, position: stage.position }).returning({ id: s.stages.id });
        await tx.insert(s.stagesI18n).values(i18nRows(stageRow.id, stage.i18n));
      }
      let [unitRow] = await tx.select({ id: s.units.id }).from(s.units).where(eq(s.units.stageId, stageRow.id)).limit(1);
      if (!unitRow) {
        [unitRow] = await tx.insert(s.units).values({ stageId: stageRow.id, position: 0 }).returning({ id: s.units.id });
        await tx.insert(s.unitsI18n).values(i18nRows(unitRow.id, stage.i18n));
      }
      unitOfStage.set(stage.slug, unitRow.id);
    }

    const existing = new Set((await tx.select({ slug: s.lessons.slug }).from(s.lessons)).map((r) => r.slug));

    for (const lesson of [...content.lessons].sort((a, b) => a.bookPage - b.bookPage)) {
      const unitId = unitOfStage.get(lesson.stage);
      if (!unitId) throw new Error(`${lesson.slug}: unknown stage "${lesson.stage}"`);
      if (existing.has(lesson.slug)) continue;

      const [lessonRow] = await tx
        .insert(s.lessons)
        .values({ unitId, slug: lesson.slug, bookPage: lesson.bookPage, position: lesson.bookPage, status: lesson.status })
        .returning({ id: s.lessons.id });
      await tx.insert(s.lessonsI18n).values(i18nRows(lessonRow.id, lesson.i18n));

      for (const [sectionPos, section] of lesson.sections.entries()) {
        const [sectionRow] = await tx
          .insert(s.lessonSections)
          .values({ lessonId: lessonRow.id, position: sectionPos, kind: section.kind, config: section.config ?? {} })
          .returning({ id: s.lessonSections.id });
        if (!section.items.length) continue;
        const itemRows = await tx
          .insert(s.items)
          .values(
            section.items.map((item, i) => ({
              sectionId: sectionRow.id,
              position: i,
              cardTypeKey: item.cardType,
              script: item.script,
              rowBand: item.rowBand,
              searchText: item.searchText,
            })),
          )
          .returning({ id: s.items.id, position: s.items.position });
        const segments = itemRows.flatMap((row) =>
          section.items[row.position].segments.map((seg, i) => ({
            itemId: row.id,
            position: i,
            text: seg.text,
            roleKey: seg.role,
            cellBreakAfter: seg.cellBreakAfter ?? false,
          })),
        );
        for (let i = 0; i < segments.length; i += 1000) await tx.insert(s.itemSegments).values(segments.slice(i, i + 1000));
      }

      for (const [rulePos, rule] of lesson.rules.entries()) {
        const [ruleRow] = await tx
          .insert(s.rules)
          .values({ lessonId: lessonRow.id, position: rulePos, example: rule.example })
          .returning({ id: s.rules.id });
        await tx.insert(s.rulesI18n).values(i18nRows(ruleRow.id, rule.i18n));
      }

      const overrides = Object.entries(lesson.games);
      if (overrides.length) {
        await tx.insert(s.lessonGameOverrides).values(
          overrides.map(([gameKey, o]) => ({ lessonId: lessonRow.id, gameKey, enabled: o.enabled ?? null, config: o.config ?? {} })),
        );
      }
    }
  });
}
