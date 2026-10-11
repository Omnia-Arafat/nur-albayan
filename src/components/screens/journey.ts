import type { LessonListItem } from "@/modules/content/service";
import type { LocalProfile } from "@/modules/progress/local";

export type Unit = { key: string; title: string; position: number; pages: LessonListItem[] };
export type Stage = { position: number; title: string; tagToken: string | null; units: Unit[] };

/** The book in order: stages, their units (topics) and pages. */
export function bookMap(lessons: LessonListItem[]): Stage[] {
  const stages: Stage[] = [];
  for (const l of lessons) {
    let st = stages.find((s) => s.position === l.stagePosition);
    if (!st)
      stages.push(
        (st = { position: l.stagePosition, title: l.stageTitle ?? "", tagToken: l.stageTagToken, units: [] }),
      );
    const key = `${l.stagePosition}.${l.unitPosition}`;
    let u = st.units.find((x) => x.key === key);
    if (!u) st.units.push((u = { key, title: l.unitTitle ?? l.title, position: l.unitPosition, pages: [] }));
    u.pages.push(l);
  }
  return stages.sort((a, b) => a.position - b.position);
}

export const isDone = (p: LocalProfile | null, page: number) => (p?.records[String(page)]?.completedCount ?? 0) > 0;

/** The page to continue from: the first unread page after the furthest page read. */
export function currentPage(lessons: LessonListItem[], p: LocalProfile | null): LessonListItem | null {
  const done = lessons.filter((l) => isDone(p, l.bookPage)).map((l) => l.bookPage);
  const furthest = done.length ? Math.max(...done) : -Infinity;
  return (
    lessons.find((l) => l.bookPage > furthest) ?? lessons.find((l) => !isDone(p, l.bookPage)) ?? lessons[0] ?? null
  );
}
