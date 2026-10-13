"use client";

import Link from "next/link";
import { useMemo } from "react";

import { useApp, useT } from "@/components/app/app-data";
import { ensureProfile } from "@/components/app/profiles";
import { Icon } from "@/components/book/icon";
import { Meter, Tag } from "@/components/book/parts";
import { earnedBadges, gameRead, openMistakes, active } from "@/modules/progress/local";
import { updateProfile, useDevice } from "@/modules/progress/store";
import { pointsFor } from "@/modules/scoring/engine";

import { useLesson } from "./use-lesson";

/** A word the games can show: the lesson's own drillable items, or banked mistakes. */
export type Word = {
  id: string;
  bookPage: number;
  segments: { text: string; role: string }[];
  script: "naskh" | "uthmani";
  cardType: string;
};

/** A shuffle that stays the same for one round (seeded by the round number). */
export const shuffled = <T,>(xs: T[], seed: number) =>
  xs
    .map((x, i) => ({ x, k: Math.sin(seed * 9973 + i * 7919) }))
    .sort((a, b) => a.k - b.k)
    .map((v) => v.x);

/** The words a game plays with. `ready` is false while the page's words are still loading. */
export function useGameWords(from: string): { words: Word[]; ready: boolean } {
  const { locale } = useApp();
  const me = active(useDevice());
  const page = from === "bank" ? null : Number(from);
  const lesson = useLesson(page, locale.code);
  return useMemo(() => {
    if (from === "bank")
      return {
        ready: true,
        words: me
          ? openMistakes(me).map((m) => ({
              id: m.itemId,
              bookPage: m.bookPage,
              segments: m.segments,
              script: "naskh" as const,
              cardType: "normal",
            }))
          : [],
      };
    if (!lesson) return { ready: false, words: [] };
    return {
      ready: true,
      words: lesson.sections.flatMap((s) =>
        s.items
          .filter((i) => i.isDrillable)
          .map((i) => ({
            id: i.id,
            bookPage: lesson.bookPage,
            segments: i.segments,
            script: i.script,
            cardType: i.cardType,
          })),
      ),
    };
  }, [from, lesson, me]);
}

/** Grades one word on a word-wall game: scores it, keeps the points and banks a miss on this device. */
export function useGradeWord() {
  const { catalog } = useApp();
  const t = useT();
  const device = useDevice();
  return (word: Word, result: "correct" | "wrong") => {
    const rules = catalog.scoring;
    if (!rules) return 0;
    const points = pointsFor(rules, { surface: "wordwall", cardTypeKey: word.cardType, result });
    updateProfile(ensureProfile(device, catalog, t("profile.defaultName")).id, (p) => {
      const next = gameRead(
        p,
        rules,
        { itemId: word.id, bookPage: word.bookPage, segments: word.segments, result },
        points,
      );
      return { ...next, badges: [...new Set([...p.badges, ...earnedBadges(next, catalog.badges)])] };
    });
    return points;
  };
}

/** Palette of a game from its fill token (color.pill.<palette>.fill). */
export const paletteOf = (fillTokenKey?: string, fallback = "lavender") => fillTokenKey?.split(".")[2] ?? fallback;

/** Shared frame for every game screen: back to the games, the game's tag and any tools on the same row. */
export function GameShell({
  gameKey,
  from,
  tools,
  children,
}: {
  gameKey: string;
  from: string;
  tools?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { catalog } = useApp();
  const t = useT();
  const game = catalog.games.find((g) => g.key === gameKey);
  const pal = paletteOf(game?.fillTokenKey);
  return (
    <main className="nb-page nb-narrow-wide">
      <div className="nb-spread">
        <Link href={t.href(`/games${/^\d+$/.test(from) ? `?page=${from}` : ""}`)} className="nb-btn nb-btn-quiet">
          <Icon name="next" size={20} tone="lavender" className="nb-flip nb-dir-flip" /> {t("nav.games")}
        </Link>
        <div className="nb-row">
          {game && (
            <Tag palette={pal}>
              <Icon name={game.iconKey} size={18} tone={pal} /> {game.name}
            </Tag>
          )}
          {tools}
        </div>
      </div>
      {children}
    </main>
  );
}

/** Shown instead of a board when the chosen page has no words to read aloud (an intro page, say). */
export function NoWords({ from, loading }: { from: string; loading?: boolean }) {
  const t = useT();
  return (
    <section className="nb-card nb-anim-rise nb-empty" aria-busy={loading || undefined}>
      {loading ? (
        <p className="nb-muted nb-center nb-m0">{t("games.loading")}</p>
      ) : (
        <>
          <span className="nb-empty-mark" aria-hidden="true">
            <Icon name="book" size={44} tone="lavender" />
          </span>
          <h2 className="nb-h2 nb-center">{t(from === "bank" ? "games.noBankWords" : "games.noWords")}</h2>
          <p className="nb-muted nb-center nb-m0">
            {t(from === "bank" ? "games.noBankWordsText" : "games.noWordsText")}
          </p>
          <Link href={t.href("/games")} className="nb-btn nb-btn-soft nb-self-center">
            {t("games.pickPage")}
          </Link>
        </>
      )}
    </section>
  );
}

/** The side panel every word game shares: words done, points and tries. */
export function RoundPanel({
  done,
  total,
  points,
  tries,
  palette,
  extra,
}: {
  done: number;
  total: number;
  points: number;
  tries: number;
  palette: string;
  extra?: React.ReactNode;
}) {
  const t = useT();
  return (
    <section className="nb-card">
      <h2 className="nb-h2">{t("ladder.round")}</h2>
      <div className="nb-spread">
        <span className="nb-muted">{t("games.words")}</span>
        <b>{t("ladder.of", { n: done, total })}</b>
      </div>
      <Meter value={total ? done / total : 0} palette={palette} />
      <div className="nb-spread">
        <span className="nb-muted">{t("ladder.points")}</span>
        <b>{t.num(points)}</b>
      </div>
      <div className="nb-spread">
        <span className="nb-muted">{t("ladder.tries")}</span>
        <b>{t.num(tries)}</b>
      </div>
      {extra}
    </section>
  );
}
