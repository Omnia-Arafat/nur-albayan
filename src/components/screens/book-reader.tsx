"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useApp, useT } from "@/components/app/app-data";
import { Caps, openShortcuts, useDir, useShortcuts } from "@/components/app/keys";
import { Icon } from "@/components/book/icon";
import { Ribbon, Tag } from "@/components/book/parts";
import { pillVars } from "@/components/book/word";
import type { Lesson } from "@/modules/content/service";
import { ariaKeys } from "@/modules/keyboard/keys";
import { active } from "@/modules/progress/local";
import { useDevice } from "@/modules/progress/store";

import { bookMap, currentPage, isDone } from "./journey";
import { NoteText, SectionView } from "./page-view";

/** Pages already asked for, shared by every reader on the device, so turning back and forth is instant. */
const cache = new Map<string, Promise<Lesson | null>>();
function loadPage(page: number, locale: string) {
  const key = `${locale}:${page}`;
  let p = cache.get(key);
  if (!p) {
    p = fetch(`/api/v1/lessons/${page}?locale=${locale}`)
      .then((r) => (r.ok ? (r.json() as Promise<Lesson>) : null))
      .catch(() => {
        cache.delete(key);
        return null;
      });
    cache.set(key, p);
  }
  return p;
}

/** Digits typed in any of the locale scripts (Arabic-Indic, Persian, Latin) as a number: each of those
 * digit blocks starts at a code point that is a multiple of 16. */
const typedNumber = (s: string) => parseInt(s.replace(/\p{Nd}/gu, (c) => String(c.codePointAt(0)! % 16)), 10);

/**
 * The whole book on the home page: unit chips, a strip with every page, and the open page itself,
 * turned with the arrows (in reading direction), a swipe, or the page strip, without leaving home.
 */
export function BookReader({ initialPage }: { initialPage?: number }) {
  const { lessons, catalog, locale } = useApp();
  const t = useT();
  const dir = useDir();
  const router = useRouter();
  const me = active(useDevice());
  const pages = lessons.map((l) => l.bookPage);
  const here = currentPage(lessons, me);
  const [chosen, setChosen] = useState<number | null>(null);
  const [turn, setTurn] = useState<"next" | "prev" | null>(null);
  const [typed, setTyped] = useState("");
  const asked = initialPage !== undefined && pages.includes(initialPage) ? initialPage : null;
  // Until the reader picks a page, the book opens where they left off.
  const page = chosen ?? asked ?? here?.bookPage ?? pages[0];
  const at = Math.max(0, pages.indexOf(page));
  const item = lessons[at];
  const [shown, setShown] = useState<Lesson | null>(null);
  const lesson = shown?.bookPage === page ? shown : null;

  const stages = bookMap(lessons);
  const stageIndex = (n: number) => stages.findIndex((s) => s.units.some((u) => u.pages.some((p) => p.bookPage === n)));
  const paletteOf = (si: number) => catalog.palette[si % catalog.palette.length] ?? "yellow";
  const stageAt = stageIndex(page);

  const box = useRef<HTMLElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const gotoField = useRef<HTMLInputElement>(null);
  const seen = useRef(false);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const prevPage = pages[at - 1];
  const nextPage = pages[at + 1];

  useEffect(() => {
    let live = true;
    loadPage(page, locale.code).then((l) => live && setShown(l));
    // The pages either side are fetched ahead, so the next turn shows at once.
    for (const n of [nextPage, prevPage]) if (n !== undefined) loadPage(n, locale.code);
    return () => {
      live = false;
    };
  }, [page, nextPage, prevPage, locale.code]);

  // Keep the open page's chip in the middle of the strip, without moving the window.
  useEffect(() => {
    const s = strip.current;
    const chip = s?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!s || !chip) return;
    const a = s.getBoundingClientRect();
    const b = chip.getBoundingClientRect();
    s.scrollBy({ left: b.left + b.width / 2 - (a.left + a.width / 2), behavior: seen.current ? "smooth" : "instant" });
    seen.current = true;
  }, [page]);

  // The keys work while any real part of the reader is on screen (measured at the key press, since a long
  // page is far taller than the window), so they don't turn pages from further down home.
  const onScreen = () => {
    const r = box.current?.getBoundingClientRect();
    return !!r && Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0) >= 80;
  };

  const go = (n: number | undefined, how?: "next" | "prev") => {
    if (n === undefined || n === page) return;
    setChosen(n);
    setTurn(how ?? (n > page ? "next" : "prev"));
    const url = new URL(window.location.href);
    url.searchParams.set("page", String(n));
    window.history.replaceState(null, "", url);
  };
  const next = () => go(nextPage, "next");
  const prev = () => go(prevPage, "prev");
  const unitStep = (step: 1 | -1) => {
    const target = stages[stageAt + step];
    if (target) go(target.units[0].pages[0].bookPage);
  };
  const openHref = t.href(`/lesson/${page}`);

  useShortcuts(
    {
      "book.next": next,
      "book.prev": prev,
      "book.first": () => go(pages[0]),
      "book.last": () => go(pages.at(-1)),
      "book.nextUnit": () => unitStep(1),
      "book.prevUnit": () => unitStep(-1),
      "book.goto": () => {
        gotoField.current?.focus();
        gotoField.current?.select();
      },
      "book.open": () => router.push(openHref),
    },
    () => onScreen() || !!box.current?.contains(document.activeElement),
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = typedNumber(typed);
    if (!Number.isFinite(n)) return;
    // The nearest page in the book at or after the number asked for (archived pages are left out).
    go(pages.find((p) => p >= n) ?? pages.at(-1));
    setTyped("");
    gotoField.current?.blur();
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") swipe.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    // Like turning a printed page: in Arabic the next page is pulled in from the left.
    if (dx > 0 === (dir === "rtl")) next();
    else prev();
  };

  if (!item) return null;
  const doneCount = lessons.filter((l) => isDone(me, l.bookPage)).length;

  return (
    <section className="nb-card nb-book" aria-labelledby="nb-book-title" ref={box}>
      <div className="nb-book-head">
        <div className="nb-book-title">
          <span className="nb-book-icon">
            <Icon name="book" size={32} />
          </span>
          <div className="nb-stack nb-gap-2">
            <h2 className="nb-h2" id="nb-book-title">
              {t("book.title")}
            </h2>
            <span className="nb-muted">{t("book.summary", { total: lessons.length, page, done: doneCount })}</span>
          </div>
        </div>
        <form className="nb-goto" onSubmit={submit}>
          <label className="nb-label" htmlFor="nb-goto-page">
            {t("book.goto")}
          </label>
          <input
            id="nb-goto-page"
            ref={gotoField}
            className="nb-input"
            inputMode="numeric"
            autoComplete="off"
            enterKeyHint="go"
            value={typed}
            placeholder={t.num(page)}
            aria-keyshortcuts="G"
            aria-describedby="nb-goto-hint"
            onChange={(e) => setTyped(e.target.value)}
          />
          <span id="nb-goto-hint" hidden>
            {t("book.gotoHint", { first: pages[0], last: pages.at(-1)! })}
          </span>
          <button type="submit" className="nb-btn nb-btn-soft">
            {t("book.go")}
          </button>
        </form>
      </div>

      <nav className="nb-strip" aria-label={t("book.units")}>
        {stages.map((s, si) => (
          <button
            key={s.position}
            type="button"
            className="nb-unit nb-tr-state nb-tr-press"
            style={pillVars(paletteOf(si))}
            aria-pressed={si === stageAt}
            onClick={() => go(s.units[0].pages[0].bookPage)}
          >
            {s.title}
          </button>
        ))}
      </nav>

      <div className="nb-pages" role="list" aria-label={t("book.pages")} ref={strip}>
        {lessons.map((l) => {
          const done = isDone(me, l.bookPage);
          const label = t("book.pageAria", { page: l.bookPage, title: l.title });
          return (
            <span role="listitem" key={l.bookPage} className="nb-contents">
              <button
                type="button"
                className="nb-pg nb-tr-state nb-tr-press"
                style={pillVars(paletteOf(stageIndex(l.bookPage)))}
                aria-current={l.bookPage === page ? "page" : undefined}
                aria-label={done ? t("book.pageRead", { label }) : label}
                onClick={() => go(l.bookPage)}
              >
                {t.num(l.bookPage)}
                {done && <span className="nb-pg-dot" aria-hidden="true" />}
              </button>
            </span>
          );
        })}
      </div>

      <div className="nb-reader">
        <button
          type="button"
          className="nb-turn nb-tr-press"
          aria-label={t("lesson.prev")}
          aria-keyshortcuts={ariaKeys("book.prev", dir)}
          disabled={prevPage === undefined}
          onClick={prev}
        >
          <Icon name="next" size={28} tone="lavender" className="nb-flip nb-dir-flip" />
        </button>
        <article
          key={page}
          className={`nb-sheet${turn ? ` nb-anim-turn-${turn}` : ""}`}
          aria-label={t("book.pageAria", { page, title: item.title })}
          aria-busy={!lesson}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (swipe.current = null)}
        >
          <div className="nb-row">
            {item.unitTag && <Ribbon colour="color.purple.deep">{item.unitTag}</Ribbon>}
            {item.lessonTag && <Ribbon colour="color.tag.lesson">{item.lessonTag}</Ribbon>}
          </div>
          <h3 className="nb-h1" lang="ar">
            {item.title}
          </h3>
          {item.subtitle && <p className="nb-sub">{item.subtitle}</p>}
          {lesson ? (
            <>
              {lesson.teacherNote && (
                <div className="nb-note">
                  <NoteText text={lesson.teacherNote} />
                </div>
              )}
              {lesson.sections.map((s) => (
                <SectionView key={s.id} section={s} palette={catalog.palette} />
              ))}
            </>
          ) : (
            <p className="nb-muted" role="status">
              {t("book.loading")}
            </p>
          )}
          <span className="nb-sheet-num">
            <Tag palette="peach">{t.num(page)}</Tag>
          </span>
        </article>
        <button
          type="button"
          className="nb-turn nb-tr-press"
          aria-label={t("lesson.next")}
          aria-keyshortcuts={ariaKeys("book.next", dir)}
          disabled={nextPage === undefined}
          onClick={next}
        >
          <Icon name="next" size={28} tone="lavender" className="nb-dir-flip" />
        </button>
      </div>

      <div className="nb-turn-row">
        <button type="button" className="nb-btn nb-btn-soft" disabled={prevPage === undefined} onClick={prev}>
          <Icon name="next" size={22} tone="lavender" className="nb-flip nb-dir-flip" /> {t("lesson.prev")}
        </button>
        <button type="button" className="nb-btn nb-btn-soft" disabled={nextPage === undefined} onClick={next}>
          {t("lesson.next")} <Icon name="next" size={22} tone="lavender" className="nb-dir-flip" />
        </button>
      </div>

      <div className="nb-row nb-row-btns">
        <Link href={openHref} className="nb-btn nb-btn-ok nb-cta nb-anim-shine" aria-keyshortcuts="Enter">
          {t("book.open")} <Icon name="next" size={22} className="nb-dir-flip" />
        </Link>
        {item.drillable > 0 && (
          <Link href={t.href(`/games?page=${page}`)} className="nb-btn nb-btn-soft">
            <Icon name="cards" size={26} />
            {t("book.play")}
          </Link>
        )}
      </div>

      <div className="nb-keys" aria-label={t("keys.label")}>
        <Icon name="keys" size={26} />
        <span>
          <Caps action="book.next" /> {t("keys.next")}
        </span>
        <span>
          <Caps action="book.prev" /> {t("keys.prev")}
        </span>
        <span>
          <Caps action="book.first" /> {t("keys.hintFirst")}
        </span>
        <span>
          <Caps action="book.last" /> {t("keys.hintLast")}
        </span>
        <button type="button" className="nb-btn nb-btn-quiet" onClick={openShortcuts}>
          <Caps action="help" /> {t("keys.all")}
        </button>
      </div>
    </section>
  );
}
