"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { useSound } from "@/components/app/sound";
import { useApp, useT } from "@/components/app/app-data";
import { useDir, useShortcuts } from "@/components/app/keys";
import { ariaKeys } from "@/modules/keyboard/keys";
import { ensureProfile } from "@/components/app/profiles";
import { Seg } from "@/components/book/controls";
import { Icon } from "@/components/book/icon";
import { Cheer, type CheerShot } from "@/components/book/cheer";
import { NumberNav } from "@/components/book/number-nav";
import { Tag } from "@/components/book/parts";
import { pillVars, Word } from "@/components/book/word";
import type { Lesson } from "@/modules/content/service";
import { PLAYABLE } from "@/modules/games/screens";
import { active, type CardRead, earnedBadges, finishLesson } from "@/modules/progress/local";
import { updateProfile, useDevice } from "@/modules/progress/store";
import { summarize } from "@/modules/scoring/engine";

import { ConnectFour, MemoryMatch, TicTacToe } from "./break-games";
import { LessonGames } from "./lesson-games";
import { lessonHref, LessonNav, type LessonView, PageBadges, PageNav } from "./lesson-nav";
import { NoteText, paletteOf, SectionView } from "./page-view";
import { Result, type ResultData } from "./result";
import { shuffled } from "./word-game";

type Mode = LessonView | "break";

const BREAKS: Record<string, (p: { from: string; embedded?: boolean }) => React.ReactNode> = {
  xo: TicTacToe,
  connect4: ConnectFour,
  memory: MemoryMatch,
};

/** Pick a cheer by weight. */
function cheerOf(list: { text: string; weight: number }[], seed: number) {
  const total = list.reduce((n, m) => n + m.weight, 0);
  let x = (seed * 9301 + 49297) % 233280;
  x = (x / 233280) * total;
  for (const m of list) if ((x -= m.weight) < 0) return m.text;
  return list[0]?.text ?? "";
}

type Neighbours = {
  prev: number | null;
  next: number | null;
  first: number | null;
  last: number | null;
};

export function LessonPlayer({
  lesson,
  prev,
  next,
  first,
  last,
  view = "page",
  game: initialGame = null,
}: { lesson: Lesson; view?: LessonView; game?: string | null } & Neighbours) {
  const { catalog, feedback } = useApp();
  const t = useT();
  const router = useRouter();
  const dir = useDir();
  const device = useDevice();
  const [mode, setModeState] = useState<Mode>(view);
  const [game, setGameState] = useState<string | null>(initialGame);
  const [i, setI] = useState(0);
  // One grade per card, by its place in the deck, so the learner can step back and read a card again.
  const [grades, setGrades] = useState<(CardRead | undefined)[]>([]);
  const reads = useMemo(() => grades.filter((g): g is CardRead => !!g), [grades]);
  // The address follows the view, so a reload, a shared link or the page strip opens the same place.
  const remember = (v: LessonView, g: string | null) =>
    window.history.replaceState(null, "", t.href(lessonHref(lesson.bookPage, v, g)));
  const setMode = (m: Mode) => {
    setModeState(m);
    if (m !== "break") remember(m, game);
  };
  // Card by card is a clean screen, like turning flash cards: no site header, no page bar.
  const focus = mode === "cards" || mode === "break";
  useEffect(() => {
    const root = document.documentElement;
    if (focus) root.dataset.focus = "cards";
    else delete root.dataset.focus;
    return () => {
      delete root.dataset.focus;
    };
  }, [focus]);
  const setGame = (g: string) => {
    setGameState(g);
    remember("games", g);
  };
  const [result, setResult] = useState<ResultData | null>(null);
  const rules = catalog.scoring;
  const play = useSound();
  // A learner's own choice on this device wins over the platform default.
  const mine = active(device)?.settings ?? {};
  const setting = <T,>(key: string, fallback: T) => (mine[key] ?? catalog.settings[key] ?? fallback) as T;
  const shuffle = setting<boolean>("lesson.shuffleCards", false) === true;
  const noPenalty = setting("lesson.noPenalty", false);
  const speedSeconds = setting("lesson.speedTimerSeconds", 10);
  const [round, setRound] = useState(1);
  const cards = useMemo(() => {
    const all = lesson.sections.flatMap((s) =>
      s.items
        .map((it, idx) => ({
          it,
          palette: paletteOf(s, it, idx, catalog.palette),
        }))
        .filter(({ it }) => it.isDrillable && s.kind !== "rule_definition" && s.kind !== "story"),
    );
    return shuffle ? shuffled(all, round) : all;
  }, [lesson, catalog.palette, shuffle, round]);
  // Breaks fall inside the deck (the one at the end is offered on the result screen).
  const breakGames = catalog.games.filter((g) => g.kind === "break" && PLAYABLE.has(g.key) && BREAKS[g.key]);
  const breakAt = setting("games.breaksEnabled", true)
    ? [
        ...new Set(
          setting<number[]>("games.breakPositions", [])
            .map((p) => Math.round(p * cards.length))
            .filter((n) => n > 0 && n < cards.length),
        ),
      ]
    : [];
  const [breakGame, setBreakGame] = useState<string | null>(null);
  const BreakGame = breakGame ? BREAKS[breakGame] : undefined;
  const card = cards[i];
  const scoreOf = (list: CardRead[]) =>
    rules
      ? summarize(
          rules,
          list.map((r) => ({
            surface: "card" as const,
            cardTypeKey: r.cardTypeKey,
            result: r.result,
            gradedBy: r.gradedBy,
            timedOut: r.timedOut,
            noPenalty: r.noPenalty,
          })),
        )
      : null;
  const live = scoreOf(reads);
  const cardType = catalog.cardTypes.find((c) => c.key === card?.it.cardType);
  /** Right reads in a row at the end of a list. */
  const runOf = (list: CardRead[]) => {
    const miss = list.findLastIndex((r) => r.result !== "correct");
    return list.length - 1 - miss;
  };
  const cheers = feedback.filter((f) => f.kind === "correct");
  const calm = feedback.filter((f) => f.kind === "wrong");
  const celebrate = setting<boolean>("lesson.celebrate", true) !== false;
  const advanceDelay = Math.max(0, Number(setting("lesson.advanceDelayMs", 700)) || 0);
  const bigEvery = Math.max(2, Number(setting("lesson.bigCheerEvery", 5)) || 5);
  const [shot, setShot] = useState<CheerShot | null>(null);
  // While a card's celebration plays, a second press does nothing.
  const busy = useRef(false);
  const [playing, setPlaying] = useState(false);

  // Speed cards count down; a right read after the timer still scores, at the late rate.
  const timed = card?.it.cardType === "speed";
  const [left, setLeft] = useState(speedSeconds);
  const [cardKey, setCardKey] = useState("");
  const thisKey = `${round}:${i}`;
  if (cardKey !== thisKey) {
    setCardKey(thisKey);
    setLeft(speedSeconds);
  }
  useEffect(() => {
    if (!timed || mode !== "cards" || left <= 0) return;
    const id = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(id);
  }, [timed, mode, left]);

  const grade = (result: "correct" | "wrong") => {
    if (!card || !rules || busy.current) return;
    play(i + 1 < cards.length ? (result === "correct" ? "correct" : "again") : "finish");
    const nextGrades = [...grades];
    nextGrades[i] = {
      itemId: card.it.id,
      cardTypeKey: card.it.cardType,
      segments: card.it.segments,
      result,
      // The teacher (or a parent) listens and grades, so the cards screen has no grader choice.
      gradedBy: "teacher",
      timedOut: timed && left <= 0,
      noPenalty,
    };
    setGrades(nextGrades);
    const nextReads = nextGrades.filter((g): g is CardRead => !!g);
    const run = runOf(nextReads);
    const gained = (scoreOf(nextReads)?.score ?? 0) - (live?.score ?? 0);
    const last = cards.findIndex((_, k) => !nextGrades[k]) === -1;
    if (celebrate)
      setShot({
        n: (shot?.n ?? 0) + 1,
        result,
        text: cheerOf(result === "correct" ? cheers : calm, nextReads.length),
        points: result === "correct" && gained > 0 ? t("lesson.plusPoints", { n: gained }) : undefined,
        big: result === "correct" && (run % bigEvery === 0 || last),
      });
    busy.current = true;
    setPlaying(true);
    setTimeout(() => {
      busy.current = false;
      setPlaying(false);
      move(nextGrades, nextReads);
    }, celebrate ? advanceDelay : 0);
  };

  /** After a grade: on to the next card still to read, a break, or the result once every card is read. */
  const move = (nextGrades: (CardRead | undefined)[], nextReads: CardRead[]) => {
    if (!rules) return;
    const open = cards.findIndex((_, k) => !nextGrades[k]);
    if (open !== -1) {
      const to = open > i ? open : nextGrades[i + 1] ? i + 1 : open;
      const fresh = !grades[i] && to === i + 1;
      setI(to);
      if (fresh && breakAt.includes(to) && breakGames.length) {
        setBreakGame(breakGames[breakAt.indexOf(to) % breakGames.length].key);
        setMode("break");
      }
      return;
    }
    // Finished: fold the session into the active device profile (one is created on first use).
    const me = ensureProfile(device, catalog, t("profile.defaultName"));
    const done = finishLesson(me, rules, lesson.bookPage, nextReads);
    const before = new Set(me.badges);
    const badges = earnedBadges(done.profile, catalog.badges);
    const profile = {
      ...done.profile,
      badges: [...new Set([...me.badges, ...badges])],
    };
    updateProfile(me.id, () => profile);
    setResult({
      summary: done.summary,
      missed: done.missed,
      newBadges: badges.filter((b) => !before.has(b)),
      profile,
      total: nextReads.length,
    });
  };

  const restart = () => {
    setGrades([]);
    setI(0);
    setResult(null);
    setMode("page");
    setRound(round + 1);
  };

  // Step through the deck: back to any card, forward over the ones already graded.
  const prevCard = () => i > 0 && setI(i - 1);
  const nextCard = () => i + 1 < cards.length && setI(i + 1);

  // Keys: on the page the arrows turn pages in reading direction; on the cards they step through the deck,
  // 1 and 2 grade, Escape goes back to the page.
  const open = (n: number | null) =>
    n !== null && n !== lesson.bookPage && router.push(t.href(lessonHref(n, mode === "break" ? "cards" : mode, game)));
  useShortcuts(
    result
      ? {}
      : mode === "page" || mode === "games"
        ? {
            "book.next": () => open(next),
            "book.prev": () => open(prev),
            "book.first": () => open(first),
            "book.last": () => open(last),
          }
        : mode === "cards"
          ? {
              "cards.right": () => grade("correct"),
              "cards.again": () => grade("wrong"),
              "book.next": nextCard,
              "book.prev": prevCard,
              "cards.back": () => setMode("page"),
            }
          : {},
  );

  if (result) return <Result lesson={lesson} data={result} next={next} onAgain={restart} />;

  return (
    <main className="nb-page nb-lesson">
      {focus ? (
        <div className="nb-focus-bar">
          <button
            type="button"
            className="nb-turn nb-tr-press"
            aria-label={t("lesson.closeCards")}
            aria-keyshortcuts="Escape"
            onClick={() => setMode("page")}
          >
            <Icon name="book" size={26} />
          </button>
          <span className="nb-focus-title" lang="ar">
            {lesson.title}
          </span>
          <Tag palette="lime">{t("lesson.points", { n: live?.score ?? 0 })}</Tag>
          <PageBadges page={lesson.bookPage} compact />
          <PageNav page={lesson.bookPage} view="cards" game={game} prev={prev} next={next} />
        </div>
      ) : (
        <LessonNav
          lesson={lesson}
          view={mode}
          game={game}
          prev={prev}
          next={next}
          hasCards={cards.length > 0}
          onView={setMode}
        />
      )}

      {mode === "break" ? (
        <section className="nb-card nb-anim-rise nb-break-embed" aria-label={t("lesson.breakTitle")}>
          <div className="nb-spread">
            <div>
              <h2 className="nb-h2">{t("lesson.breakTitle")}</h2>
              <p className="nb-muted nb-m0">{t("lesson.breakText")}</p>
            </div>
            <button type="button" className="nb-btn nb-btn-ok" onClick={() => setMode("cards")}>
              {t("lesson.continue")} <Icon name="next" size={22} className="nb-dir-flip" />
            </button>
          </div>
          <Seg
            label={t("games.breaks")}
            value={breakGame ?? breakGames[0]?.key ?? ""}
            onChange={setBreakGame}
            options={breakGames.map((g) => ({ value: g.key, label: g.name }))}
          />
          {BreakGame && <BreakGame key={breakGame} from={String(lesson.bookPage)} embedded />}
        </section>
      ) : mode === "games" && cards.length > 0 ? (
        <LessonGames page={lesson.bookPage} game={game} onGame={setGame} />
      ) : mode === "cards" && card ? (
        <section className="nb-card nb-anim-rise nb-cards" aria-label={t("lesson.cards")}>
          <div className="nb-row nb-gap-8 nb-center">
            {cardType && card.it.cardType !== "normal" && (
              <Tag palette="yellow">
                <Icon name={cardType.iconKey} size={18} /> {cardType.label}
              </Tag>
            )}
            {timed && (
              <Tag palette={left > 0 ? "sky" : "salmon"}>
                <Icon name="timer" size={18} /> {left > 0 ? t("lesson.timeLeft", { n: t.num(left) }) : t("lesson.late")}
              </Tag>
            )}
          </div>
          <NumberNav
            id="nb-card-nav"
            label={t("lesson.navCard")}
            value={i + 1}
            total={t("lesson.navOf", { total: cards.length })}
            onGo={(n) => setI(Math.min(cards.length, Math.max(1, n)) - 1)}
            onPrev={i > 0 ? prevCard : null}
            onNext={i + 1 < cards.length ? nextCard : null}
            prevLabel={t("lesson.prevCard")}
            nextLabel={t("lesson.nextCard")}
            prevKeys={ariaKeys("book.prev", dir)}
            nextKeys={ariaKeys("book.next", dir)}
          />
          <div className="nb-card-stage">
            <div
              key={`${card.it.id}:${shot?.n ?? 0}`}
              className={`nb-bigcard ${
                playing && shot ? (shot.result === "correct" ? "nb-anim-right" : "nb-anim-shake") : "nb-anim-pop"
              }`}
              data-graded={grades[i]?.result}
              style={{
                ...pillVars(card.palette),
                fontFamily: card.it.script === "uthmani" ? "var(--nb-font-quran)" : undefined,
              }}
            >
              <Word segments={card.it.segments} />
            </div>
            <Cheer shot={shot} palette={catalog.palette} />
          </div>
          <div className="nb-row nb-row-btns nb-center">
            <button
              type="button"
              className="nb-btn nb-btn-ok nb-btn-big"
              aria-keyshortcuts={ariaKeys("cards.right", dir)}
              aria-pressed={grades[i]?.result === "correct"}
              onClick={() => grade("correct")}
            >
              <Icon name="check" size={26} colours={{ fill: "color.surface", line: "color.surface" }} />{" "}
              {t("lesson.right")}
            </button>
            <button
              type="button"
              className="nb-btn nb-btn-again nb-btn-big"
              aria-keyshortcuts={ariaKeys("cards.again", dir)}
              aria-pressed={grades[i]?.result === "wrong"}
              onClick={() => grade("wrong")}
            >
              {t("lesson.again")}
            </button>
          </div>
        </section>
      ) : (
        <section className="nb-card nb-anim-rise" aria-label={t("lesson.pageTag", { page: lesson.bookPage })}>
          <div className="nb-spread">
            {lesson.subtitle ? <p className="nb-sub nb-m0">{lesson.subtitle}</p> : <span />}
            <Tag palette="salmon">{t("lesson.pageTag", { page: lesson.bookPage })}</Tag>
          </div>
          {lesson.teacherNote && (
            <div className="nb-note">
              <NoteText text={lesson.teacherNote} />
            </div>
          )}
          {lesson.sections.map((s) => (
            <SectionView key={s.id} section={s} palette={catalog.palette} />
          ))}
          {cards.length > 0 && (
            <div className="nb-row nb-row-btns">
              <button type="button" className="nb-btn nb-btn-ok nb-anim-shine nb-cta" onClick={() => setMode("cards")}>
                {t("lesson.startCards")} <Icon name="next" size={22} className="nb-dir-flip" />
              </button>
              <button type="button" className="nb-btn nb-btn-soft" onClick={() => setMode("games")}>
                <Icon name="cards" size={26} />
                {t("lesson.wordGames")}
              </button>
            </div>
          )}
        </section>
      )}
    </main>
  );
}

