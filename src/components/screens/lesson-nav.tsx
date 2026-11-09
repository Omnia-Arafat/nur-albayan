"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { useApp, useT } from "@/components/app/app-data";
import { useDir } from "@/components/app/keys";
import { Seg } from "@/components/book/controls";
import { Icon } from "@/components/book/icon";
import { NumberNav } from "@/components/book/number-nav";
import { Ribbon } from "@/components/book/parts";
import { pillVars } from "@/components/book/word";
import type { Lesson } from "@/modules/content/service";
import { ariaKeys } from "@/modules/keyboard/keys";
import { active, openMistakes } from "@/modules/progress/local";
import { useDevice } from "@/modules/progress/store";

import { bookMap, isDone } from "./journey";

export type LessonView = "page" | "cards" | "games";

/** The address of a page in a given view, so turning pages keeps you on the cards or the same game. */
export const lessonHref = (page: number, view: LessonView, game?: string | null) =>
  `/lesson/${page}${view === "page" ? "" : `?view=${view}${view === "games" && game ? `&game=${game}` : ""}`}`;

/**
 * The bar on top of every lesson: the page's tags and title, the learner's progress on this page,
 * the whole book as a strip of page numbers with turn arrows either side, and the three views
 * (the book page, card by card, the games) one tap apart.
 */
export function LessonNav({
  lesson,
  view,
  game,
  prev,
  next,
  hasCards,
  onView,
}: {
  lesson: Lesson;
  view: LessonView;
  game: string | null;
  prev: number | null;
  next: number | null;
  hasCards: boolean;
  onView: (v: LessonView) => void;
}) {
  const { lessons, catalog } = useApp();
  const t = useT();
  const me = active(useDevice());
  const stages = bookMap(lessons);
  const stageOf = (n: number) =>
    Math.max(
      0,
      stages.findIndex((s) => s.units.some((u) => u.pages.some((p) => p.bookPage === n))),
    );
  const paletteOf = (si: number) => catalog.palette[si % catalog.palette.length] ?? "yellow";
  const strip = useRef<HTMLDivElement>(null);
  const seen = useRef(false);

  // Keep this page's number in the middle of the strip, without moving the window.
  useEffect(() => {
    const s = strip.current;
    const chip = s?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!s || !chip) return;
    const a = s.getBoundingClientRect();
    const b = chip.getBoundingClientRect();
    s.scrollBy({
      left: b.left + b.width / 2 - (a.left + a.width / 2),
      behavior: seen.current ? "smooth" : "instant",
    });
    seen.current = true;
  }, [lesson.bookPage]);

  const href = (n: number) => t.href(lessonHref(n, view, game));
  const views: { value: LessonView; label: string }[] = [
    { value: "page", label: t("lesson.tabPage") },
    ...(hasCards
      ? [
          { value: "cards" as const, label: t("lesson.tabCards") },
          { value: "games" as const, label: t("lesson.tabGames") },
        ]
      : []),
  ];

  return (
    <section className="nb-card nb-lesson-nav" aria-label={t("book.pages")}>
      <div className="nb-lesson-head">
        <div className="nb-stack nb-gap-2 nb-min0">
          <div className="nb-row nb-gap-8">
            {lesson.unitTag && <Ribbon colour="color.purple.deep">{lesson.unitTag}</Ribbon>}
            {lesson.lessonTag && <Ribbon colour="color.tag.lesson">{lesson.lessonTag}</Ribbon>}
          </div>
          <h1 className="nb-lesson-title" lang="ar">
            {lesson.title}
          </h1>
        </div>
        <PageBadges page={lesson.bookPage} />
      </div>

      <PageNav page={lesson.bookPage} view={view} game={game} prev={prev} next={next} />

      <div className="nb-pages" role="list" aria-label={t("book.pages")} ref={strip}>
        {lessons.map((l) => {
          const label = t("book.pageAria", {
            page: l.bookPage,
            title: l.title,
          });
          const done = isDone(me, l.bookPage);
          return (
            <span role="listitem" key={l.bookPage} className="nb-contents">
              <Link
                href={href(l.bookPage)}
                className="nb-pg nb-tr-state nb-tr-press"
                style={pillVars(paletteOf(stageOf(l.bookPage)))}
                aria-current={l.bookPage === lesson.bookPage ? "page" : undefined}
                aria-label={done ? t("book.pageRead", { label }) : label}
                scroll={false}
              >
                {t.num(l.bookPage)}
                {done && <span className="nb-pg-dot" aria-hidden="true" />}
              </Link>
            </span>
          );
        })}
      </div>

      {views.length > 1 && <Seg label={t("lesson.view")} value={view} onChange={onView} options={views} wide />}
    </section>
  );
}

/** What the learner has won on this page (stars, best score, words still to review) next to all their badges. */
export function PageBadges({ page, compact }: { page: number; compact?: boolean }) {
  const { catalog } = useApp();
  const t = useT();
  const me = active(useDevice());
  const rec = me?.records[String(page)];
  const maxStars = Math.max(3, ...(catalog.scoring?.stars ?? []).map((s) => s.stars));
  const stars = rec?.stars ?? 0;
  const review = me ? openMistakes(me).filter((m) => m.bookPage === page).length : 0;
  const got = me ? catalog.badges.filter((b) => me.badges.includes(b.key)).length : 0;
  return (
    <div className="nb-page-badges" aria-label={t("lesson.pageBadges")}>
      <span
        className="nb-page-stars"
        role="img"
        aria-label={t("lesson.pageStars", { n: stars, total: maxStars })}
        title={t("lesson.pageStars", { n: stars, total: maxStars })}
      >
        {Array.from({ length: maxStars }, (_, i) => (
          <Icon key={i} name="star" size={24} tone={i < stars ? undefined : "gray"} />
        ))}
      </span>
      {!compact && rec && rec.completedCount > 0 && (
        <span className="nb-chip" style={pillVars("lime")}>
          <Icon name="trophy" size={20} tone="lime" /> {t("lesson.best", { n: rec.bestScore })}
        </span>
      )}
      {review > 0 && (
        <Link href={t.href("/mistakes")} className="nb-chip nb-tr-press" style={pillVars("salmon")}>
          <Icon name="review" size={20} tone="salmon" /> {t("lesson.toReview", { n: review })}
        </Link>
      )}
      {!compact && (
        <Link href={t.href("/badges")} className="nb-chip nb-tr-press" style={pillVars("lavender")}>
          <Icon name="crown" size={20} tone="lavender" />{" "}
          {t("lesson.allBadges", { n: got, total: catalog.badges.length })}
        </Link>
      )}
    </div>
  );
}

/** The page box: an arrow either side and the page number, which you can type over to open any page. */
export function PageNav({
  page,
  view,
  game,
  prev,
  next,
}: {
  page: number;
  view: LessonView;
  game: string | null;
  prev: number | null;
  next: number | null;
}) {
  const { lessons } = useApp();
  const t = useT();
  const dir = useDir();
  const router = useRouter();
  const pages = lessons.map((l) => l.bookPage);
  const open = (n: number | null | undefined) =>
    n !== null && n !== undefined && n !== page && router.push(t.href(lessonHref(n, view, game)), { scroll: false });
  return (
    <NumberNav
      id="nb-page-nav"
      label={t("lesson.navPage")}
      value={page}
      total={t("lesson.navOf", { total: pages.at(-1) ?? page })}
      // The nearest page in the book at or after the number asked for (archived pages are left out).
      onGo={(n) => open(pages.find((p) => p >= n) ?? pages.at(-1))}
      onPrev={prev !== null ? () => open(prev) : null}
      onNext={next !== null ? () => open(next) : null}
      prevLabel={t("lesson.prev")}
      nextLabel={t("lesson.next")}
      prevKeys={view === "cards" ? undefined : ariaKeys("book.prev", dir)}
      nextKeys={view === "cards" ? undefined : ariaKeys("book.next", dir)}
    />
  );
}
