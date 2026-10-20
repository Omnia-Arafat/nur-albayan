/**
 * Bring book pages already in the database in line with seed/content (after a proofreading pass on seed/book).
 * The content seed skips pages that exist, so corrections to the source never reach a live database without this.
 *   pnpm book:sync            show what would change
 *   pnpm book:sync --apply    write it
 * Works on Postgres (DATABASE_URL_DIRECT or DATABASE_URL) and on the local pglite: database.
 * Items keep their ids where they still exist (attempts and mistake banks point at them): only their fields and
 * segments are rewritten. Each changed page gets a new version and a content_revisions row, like an admin edit.
 */
import { PGlite } from "@electric-sql/pglite";
import { config } from "dotenv";
import { and, eq, inArray } from "drizzle-orm";
import { drizzle as drizzleLite } from "drizzle-orm/pglite";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as s from "../../src/db/schema";
import { loadContent, type ContentLesson } from "../../src/db/seed/content";

config({ path: [".env.local", ".env"] });
const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const apply = process.argv.includes("--apply");

type Tx = Parameters<Parameters<ReturnType<typeof drizzle>["transaction"]>[0]>[0];
type Item = ContentLesson["sections"][number]["items"][number];

const segKey = (segs: { text: string; role: string; cellBreakAfter?: boolean | null }[]) =>
  JSON.stringify(segs.map((g) => [g.text, g.role, Boolean(g.cellBreakAfter)]));
/** Deep equality that ignores key order (jsonb does not keep it). */
const sorted = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(sorted)
    : v && typeof v === "object"
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, sorted((v as Record<string, unknown>)[k])]),
        )
      : v;
const same = (a: unknown, b: unknown) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));

async function imageAsset(tx: Tx, slug: string, alt: string) {
  const storagePath = `book/images/${slug}.webp`;
  let [row] = await tx.select({ id: s.assets.id }).from(s.assets).where(eq(s.assets.storagePath, storagePath));
  if (!row) {
    [row] = await tx
      .insert(s.assets)
      .values({ kind: "image", storagePath, mimeType: "image/webp" })
      .returning({ id: s.assets.id });
    await tx.insert(s.assetsI18n).values([
      { entityId: row.id, locale: "ar", alt },
      { entityId: row.id, locale: "en", alt: slug.replace(/-/g, " ") },
    ]);
  }
  return row.id;
}

const itemValues = async (tx: Tx, item: Item) => ({
  cardTypeKey: item.cardType,
  script: item.script,
  rowBand: item.rowBand,
  isDrillable: item.drillable ?? true,
  tintTokenKey: item.tint ? `color.${item.tint}` : null,
  imageAssetId: item.image ? await imageAsset(tx, item.image, item.searchText) : null,
  searchText: item.searchText,
});

async function writeSegments(tx: Tx, itemId: string, item: Item) {
  await tx.delete(s.itemSegments).where(eq(s.itemSegments.itemId, itemId));
  await tx.insert(s.itemSegments).values(
    item.segments.map((seg, i) => ({
      itemId,
      position: i,
      text: seg.text,
      roleKey: seg.role,
      cellBreakAfter: seg.cellBreakAfter ?? false,
    })),
  );
}

/** Returns a description of what differs (empty when the page already matches). */
async function syncLesson(tx: Tx, lesson: ContentLesson): Promise<string[]> {
  const changes: string[] = [];
  const [row] = await tx.select().from(s.lessons).where(eq(s.lessons.slug, lesson.slug));
  if (!row) return [`missing in the database (the content seed adds it)`];

  for (const [locale, t] of Object.entries(lesson.i18n)) {
    const key = and(eq(s.lessonsI18n.entityId, row.id), eq(s.lessonsI18n.locale, locale));
    const [prev] = await tx.select().from(s.lessonsI18n).where(key);
    const values = {
      title: t.title,
      subtitle: t.subtitle ?? null,
      teacherNote: t.teacherNote ?? null,
      unitTag: t.unitTag ?? null,
      lessonTag: t.lessonTag ?? null,
      observeTag: t.observeTag ?? null,
    };
    const before = prev && {
      title: prev.title,
      subtitle: prev.subtitle,
      teacherNote: prev.teacherNote,
      unitTag: prev.unitTag,
      lessonTag: prev.lessonTag,
      observeTag: prev.observeTag,
    };
    if (same(before, values)) continue;
    changes.push(`i18n.${locale}`);
    if (prev) await tx.update(s.lessonsI18n).set(values).where(key);
    else await tx.insert(s.lessonsI18n).values({ entityId: row.id, locale, ...values });
  }

  const sections = await tx
    .select()
    .from(s.lessonSections)
    .where(eq(s.lessonSections.lessonId, row.id))
    .orderBy(s.lessonSections.position);
  for (const [pos, sec] of lesson.sections.entries()) {
    let dbSec = sections[pos];
    if (dbSec && dbSec.kind !== sec.kind) {
      await tx.delete(s.lessonSections).where(eq(s.lessonSections.id, dbSec.id));
      changes.push(`section ${pos + 1}: kind ${dbSec.kind} -> ${sec.kind}, rebuilt`);
      dbSec = undefined as unknown as typeof dbSec;
    }
    if (!dbSec) {
      [dbSec] = await tx
        .insert(s.lessonSections)
        .values({ lessonId: row.id, position: pos, kind: sec.kind, config: sec.config ?? {} })
        .returning();
      if (!changes.at(-1)?.startsWith(`section ${pos + 1}:`)) changes.push(`section ${pos + 1}: added`);
    } else if (!same(dbSec.config, sec.config ?? {})) {
      await tx
        .update(s.lessonSections)
        .set({ config: sec.config ?? {}, updatedAt: new Date() })
        .where(eq(s.lessonSections.id, dbSec.id));
      changes.push(`section ${pos + 1}: config`);
    }

    const items = await tx
      .select()
      .from(s.items)
      .where(eq(s.items.sectionId, dbSec.id))
      .orderBy(s.items.position);
    const segs = items.length
      ? await tx
          .select()
          .from(s.itemSegments)
          .where(
            inArray(
              s.itemSegments.itemId,
              items.map((i) => i.id),
            ),
          )
          .orderBy(s.itemSegments.position)
      : [];
    for (const [i, item] of sec.items.entries()) {
      const values = await itemValues(tx, item);
      const cur = items[i];
      if (!cur) {
        const [created] = await tx
          .insert(s.items)
          .values({ sectionId: dbSec.id, position: i, ...values })
          .returning({ id: s.items.id });
        await writeSegments(tx, created.id, item);
        changes.push(`section ${pos + 1} item ${i + 1}: added ${item.searchText}`);
        continue;
      }
      const curSegs = segs
        .filter((g) => g.itemId === cur.id)
        .map((g) => ({ text: g.text, role: g.roleKey, cellBreakAfter: g.cellBreakAfter }));
      const fieldsDiffer = (Object.keys(values) as (keyof typeof values)[]).some((k) => cur[k] !== values[k]);
      const segsDiffer = segKey(curSegs) !== segKey(item.segments);
      if (!fieldsDiffer && !segsDiffer) continue;
      if (fieldsDiffer) await tx.update(s.items).set({ ...values, updatedAt: new Date() }).where(eq(s.items.id, cur.id));
      if (segsDiffer) await writeSegments(tx, cur.id, item);
      changes.push(
        `section ${pos + 1} item ${i + 1}: ${curSegs.map((g) => g.text).join("")} -> ${item.segments.map((g) => g.text).join("")}`,
      );
    }
    const extra = items.slice(sec.items.length);
    if (extra.length) {
      await tx.delete(s.items).where(
        inArray(
          s.items.id,
          extra.map((x) => x.id),
        ),
      );
      changes.push(`section ${pos + 1}: removed ${extra.length} item(s) the book does not have`);
    }
  }
  const extraSections = sections.slice(lesson.sections.length);
  if (extraSections.length) {
    await tx.delete(s.lessonSections).where(
      inArray(
        s.lessonSections.id,
        extraSections.map((x) => x.id),
      ),
    );
    changes.push(`removed ${extraSections.length} section(s) the book does not have`);
  }

  if (changes.length) {
    await tx
      .update(s.lessons)
      .set({ version: row.version + 1, updatedAt: new Date() })
      .where(eq(s.lessons.id, row.id));
    await tx.insert(s.contentRevisions).values({
      entityTable: "lessons",
      entityId: row.id,
      diff: { source: "book proofreading sync", changes },
      authorId: null,
    });
  }
  return changes;
}

class DryRun extends Error {}

async function main() {
  const lite = url!.startsWith("pglite:") ? new PGlite(url!.slice("pglite:".length)) : null;
  const client = lite ? null : postgres(url!, { prepare: false, max: 1 });
  // Both drivers share the query builder; the sync only uses what they have in common.
  const db = (lite ? drizzleLite(lite) : drizzle(client!)) as ReturnType<typeof drizzle>;
  const { lessons } = loadContent();
  let pages = 0;
  try {
    await db.transaction(async (tx) => {
      for (const lesson of [...lessons].sort((a, b) => a.bookPage - b.bookPage)) {
        const changes = await syncLesson(tx, lesson);
        if (!changes.length) continue;
        pages++;
        console.log(`page ${lesson.bookPage}:`);
        for (const c of changes) console.log(`  ${c}`);
      }
      if (!apply) throw new DryRun();
    });
  } catch (e) {
    if (!(e instanceof DryRun)) throw e;
  }
  await (lite ? lite.close() : client!.end());
  console.log(`${pages} page(s) ${apply ? "updated" : "differ (dry run, nothing written; add --apply)"}.`);
}

main();
