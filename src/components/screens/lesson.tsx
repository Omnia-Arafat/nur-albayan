"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useApp, useT } from "@/components/app/app-data";
import { ensureProfile } from "@/components/app/profiles";
import { Seg } from "@/components/book/controls";
import { Icon } from "@/components/book/icon";
import { Meter, Ribbon, Tag } from "@/components/book/parts";
import { pillVars, Word } from "@/components/book/word";
import type { Lesson } from "@/modules/content/service";
import { PLAYABLE } from "@/modules/games/screens";
import { active, type CardRead, earnedBadges, finishLesson } from "@/modules/progress/local";
import { updateProfile, useDevice } from "@/modules/progress/store";
import { summarize } from "@/modules/scoring/engine";

import { ConnectFour, MemoryMatch, TicTacToe } from "./break-games";
import { NoteText, paletteOf, SectionView } from "./page-view";
import { Result, type ResultData } from "./result";
import { shuffled } from "./word-game";

type Mode = "page" | "cards" | "break";

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

export function LessonPlayer({ lesson, prev, next }: { lesson: Lesson; prev: number | null; next: number | null }) {
  const { catalog, feedback } = useApp();
  const t = useT();
  const device = useDevice();
  const [mode, setMode] = useState<Mode>("page");
  const [grader, setGrader] = useState<"teacher" | "self">("teacher");
  const [i, setI] = useState(0);
  const [reads, setReads] = useState<CardRead[]>([]);
  const [result, setResult] = useState<ResultData | null>(null);
  const rules = catalog.scoring;
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
        .map((it, idx) => ({ it, palette: paletteOf(s, it, idx, catalog.palette) }))
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
  const live = rules
    ? summarize(
        rules,
        reads.map((r) => ({
          surface: "card" as const,
          cardTypeKey: r.cardTypeKey,
          result: r.result,
          gradedBy: r.gradedBy,
          timedOut: r.timedOut,
          noPenalty: r.noPenalty,
        })),
      )
    : null;
  const cardType = catalog.cardTypes.find((c) => c.key === card?.it.cardType);
  const streak =
    reads.length && reads.at(-1)!.result === "correct"
      ? reads
          .slice()
          .reverse()
          .findIndex((r) => r.result !== "correct")
      : 0;
  const cheers = feedback.filter((f) => f.kind === "correct");

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
    if (!card || !rules) return;
    const nextReads = [
      ...reads,
      {
        itemId: card.it.id,
        cardTypeKey: card.it.cardType,
        segments: card.it.segments,
        result,
        gradedBy: grader,
        timedOut: timed && left <= 0,
        noPenalty,
      },
    ];
    setReads(nextReads);
    if (i + 1 < cards.length) {
      setI(i + 1);
      if (breakAt.includes(i + 1) && breakGames.length) {
        setBreakGame(breakGames[breakAt.indexOf(i + 1) % breakGames.length].key);
        setMode("break");
      }
      return;
    }
    // Finished: fold the session into the active device profile (one is created on first use).
    const me = ensureProfile(device, catalog, t("profile.defaultName"));
    const done = finishLesson(me, rules, lesson.bookPage, nextReads);
    const before = new Set(me.badges);
    const badges = earnedBadges(done.profile, catalog.badges);
    const profile = { ...done.profile, badges: [...new Set([...me.badges, ...badges])] };
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
    setReads([]);
    setI(0);
    setResult(null);
    setMode("page");
    setRound(round + 1);
  };

  if (result) return <Result lesson={lesson} data={result} next={next} onAgain={restart} />;

  return (
    <main className="nb-page nb-lesson">
      <div className="nb-spread">
        <div className="nb-row">
          {lesson.unitTag && <Ribbon colour="color.purple.deep">{lesson.unitTag}</Ribbon>}
          {lesson.observeTag && <Ribbon colour="color.teal.deep">{lesson.observeTag}</Ribbon>}
          {lesson.lessonTag && <Ribbon colour="color.tag.lesson">{lesson.lessonTag}</Ribbon>}
        </div>
        {cards.length > 0 && mode !== "break" && (
          <Seg
            label={t("lesson.view")}
            value={mode}
            onChange={(m) => setMode(m)}
            options={[
              { value: "page", label: t("lesson.page") },
              { value: "cards", label: t("lesson.cards") },
            ]}
          />
        )}
      </div>

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
      ) : mode === "page" ? (
        <section className="nb-card nb-anim-rise" aria-label={t("lesson.pageTag", { page: lesson.bookPage })}>
          <div className="nb-spread">
            <h1 className="nb-h1" lang="ar">
              {lesson.title}
            </h1>
            <Tag palette="salmon">{t("lesson.pageTag", { page: lesson.bookPage })}</Tag>
          </div>
          {lesson.subtitle && <p className="nb-sub">{lesson.subtitle}</p>}
          {lesson.teacherNote && (
            <div className="nb-note">
              <NoteText text={lesson.teacherNote} />
            </div>
          )}
          {lesson.sections.map((s) => (
            <SectionView key={s.id} section={s} palette={catalog.palette} />
          ))}
          <div className="nb-row nb-row-btns">
            {cards.length > 0 && (
              <button type="button" className="nb-btn nb-btn-ok nb-anim-shine nb-cta" onClick={() => setMode("cards")}>
                {t("lesson.startCards")} <Icon name="next" size={22} className="nb-dir-flip" />
              </button>
            )}
            {cards.length > 0 && (
              <Link href={t.href(`/games?page=${lesson.bookPage}`)} className="nb-btn nb-btn-soft">
                <Icon name="cards" size={26} />
                {t("lesson.wordGames")}
              </Link>
            )}
          </div>
          <nav className="nb-spread nb-pager" aria-label={t("lesson.pageTag", { page: lesson.bookPage })}>
            {prev !== null ? (
              <Link href={t.href(`/lesson/${prev}`)} className="nb-btn nb-btn-quiet">
                <Icon name="next" size={20} tone="lavender" className="nb-flip nb-dir-flip" /> {t("lesson.prev")}
              </Link>
            ) : (
              <span />
            )}
            {next !== null && (
              <Link href={t.href(`/lesson/${next}`)} className="nb-btn nb-btn-quiet">
                {t("lesson.next")} <Icon name="next" size={20} tone="lavender" className="nb-dir-flip" />
              </Link>
            )}
          </nav>
        </section>
      ) : (
        card && (
          <section className="nb-card nb-anim-rise nb-cards" aria-label={t("lesson.cards")}>
            <div className="nb-spread nb-full">
              <span className="nb-muted">{t("lesson.cardOf", { n: i + 1, total: cards.length })}</span>
              <span className="nb-row nb-gap-8">
                {cardType && card.it.cardType !== "normal" && (
                  <Tag palette="yellow">
                    <Icon name={cardType.iconKey} size={18} /> {cardType.label}
                  </Tag>
                )}
                {timed && (
                  <Tag palette={left > 0 ? "sky" : "salmon"}>
                    <Icon name="timer" size={18} />{" "}
                    {left > 0 ? t("lesson.timeLeft", { n: t.num(left) }) : t("lesson.late")}
                  </Tag>
                )}
                <Tag palette="lime">{t("lesson.points", { n: live?.score ?? 0 })}</Tag>
              </span>
            </div>
            <Meter value={i / cards.length} label={t("lesson.cardOf", { n: i + 1, total: cards.length })} />
            <div
              key={card.it.id}
              className="nb-bigcard nb-anim-pop"
              style={{
                ...pillVars(card.palette),
                fontFamily: card.it.script === "uthmani" ? "var(--nb-font-quran)" : undefined,
              }}
            >
              <Word segments={card.it.segments} />
            </div>
            {streak > 0 && cheers.length > 0 && (
              <span key={reads.length} className="nb-toast nb-anim-pop" role="status">
                <Icon name="star" size={22} /> {cheerOf(cheers, reads.length)}
              </span>
            )}
            <p className="nb-muted nb-center">{t("lesson.readAloud")}</p>
            <div className="nb-row nb-row-btns nb-center">
              <button type="button" className="nb-btn nb-btn-ok nb-btn-big" onClick={() => grade("correct")}>
                <Icon name="check" size={26} colours={{ fill: "color.surface", line: "color.surface" }} />{" "}
                {t("lesson.right")}
              </button>
              <button type="button" className="nb-btn nb-btn-again nb-btn-big" onClick={() => grade("wrong")}>
                {t("lesson.again")}
              </button>
            </div>
            <div className="nb-row nb-center">
              <span className="nb-label">{t("lesson.grader")}</span>
              <Seg
                label={t("lesson.grader")}
                value={grader}
                onChange={setGrader}
                options={[
                  { value: "teacher", label: t("lesson.graderTeacher") },
                  { value: "self", label: t("lesson.graderSelf") },
                ]}
              />
            </div>
          </section>
        )
      )}
    </main>
  );
}
