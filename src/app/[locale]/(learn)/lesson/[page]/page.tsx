import { notFound } from "next/navigation";

import { LessonPlayer } from "@/components/screens/lesson";
import { getDb } from "@/db/client";
import { pageParam } from "@/lib/api";
import { getLesson, listLessons } from "@/modules/content/service";

export default async function Page(props: PageProps<"/[locale]/lesson/[page]">) {
  const [{ locale, page }, q] = await Promise.all([props.params, props.searchParams]);
  const n = pageParam.safeParse(page);
  if (!n.success) notFound();
  const db = await getDb();
  const lesson = await getLesson(db, n.data, locale);
  if (!lesson) notFound();
  const pages = (await listLessons(db, locale)).map((l) => l.bookPage);
  const at = pages.indexOf(lesson.bookPage);
  return (
    <LessonPlayer
      lesson={lesson}
      prev={pages[at - 1] ?? null}
      next={pages[at + 1] ?? null}
      first={pages[0] ?? null}
      last={pages.at(-1) ?? null}
      view={q.view === "cards" || q.view === "games" ? q.view : "page"}
      game={typeof q.game === "string" && /^[a-z0-9-]+$/.test(q.game) ? q.game : null}
    />
  );
}
