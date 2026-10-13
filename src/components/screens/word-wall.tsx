"use client";

import { useRef, useState } from "react";

import { useApp, useT } from "@/components/app/app-data";
import { Icon } from "@/components/book/icon";
import { Pill, pillVars } from "@/components/book/word";
import type { WallGame } from "@/modules/games/screens";

import {
  GameShell,
  NoWords,
  paletteOf,
  RoundPanel,
  shuffled,
  useGameWords,
  useGradeWord,
  type Word,
} from "./word-game";

/**
 * The word-wall room: one board of the lesson's words, played six ways. Each way only changes how a
 * word is chosen and revealed (open a box, lift a curtain, flip a tile, tap a honeycomb cell, deal a
 * card, spin the wheel); grading, points and the mistake bank are the same for all of them.
 */

type Mark = "done" | "review";
const PALETTES = ["yellow", "sky", "pink", "lime", "peach", "mint", "lavender"];

export function WordWall({ game, from }: { game: WallGame; from: string }) {
  const { catalog } = useApp();
  const t = useT();
  const grade = useGradeWord();
  const { words, ready } = useGameWords(from);
  const meta = catalog.games.find((g) => g.key === game);
  const pal = paletteOf(meta?.fillTokenKey);
  const size = (meta?.defaultConfig as { boardSize?: number } | undefined)?.boardSize ?? words.length;
  const [round, setRound] = useState(1);
  const board = shuffled(words, round).slice(0, size);
  const key = `${round}:${board.map((w) => w.id).join(",")}`;
  const fresh = () => ({
    key,
    marks: {} as Record<string, Mark>,
    open: null as string | null,
    deck: board.map((w) => w.id),
    turn: 0,
    points: 0,
    tries: 0,
  });
  const [run, setRun] = useState(fresh);
  // A new board starts a new round (state reset during render, not in an effect).
  if (run.key !== key) setRun(fresh());
  const r = run.key === key ? run : fresh();

  if (!ready || !words.length)
    return (
      <GameShell gameKey={game} from={from}>
        <NoWords from={from} loading={!ready} />
      </GameShell>
    );

  const byId = new Map(board.map((w) => [w.id, w]));
  const current = r.open ? byId.get(r.open) : undefined;
  const done = board.filter((w) => r.marks[w.id] === "done").length;
  const review = board.filter((w) => r.marks[w.id] === "review").length;
  const finished = game === "cards" ? r.deck.length === 0 : board.every((w) => r.marks[w.id]);

  const open = (id: string) => {
    if (r.open || r.marks[id] === "done") return;
    setRun({ ...r, open: id });
  };
  const judge = (result: "correct" | "wrong") => {
    if (!current) return;
    const points = grade(current, result);
    const deck = game === "cards" ? r.deck.filter((id) => id !== current.id) : r.deck;
    setRun({
      ...r,
      open: null,
      marks: { ...r.marks, [current.id]: result === "correct" ? "done" : "review" },
      // In the deck a missed card goes back under the others.
      deck: game === "cards" && result === "wrong" ? [...deck, current.id] : deck,
      points: r.points + points,
      tries: r.tries + 1,
    });
  };

  const cell = (w: Word, k: number) => {
    const mark = r.marks[w.id];
    const isOpen = r.open === w.id;
    const shown = game === "honeycomb" || isOpen || mark === "done";
    const label = shown ? undefined : t("games.cellLabel", { n: t.num(k + 1) });
    return (
      <button
        key={w.id}
        type="button"
        className={`nb-wall-cell nb-tr-press${isOpen ? " open" : ""}${mark ? ` ${mark}` : ""}`}
        style={pillVars(PALETTES[k % PALETTES.length])}
        disabled={mark === "done" || (r.open !== null && !isOpen)}
        aria-label={label}
        aria-pressed={isOpen || undefined}
        onClick={() => open(w.id)}
      >
        {shown ? (
          <span className={game === "tiles" && isOpen ? "nb-anim-flip nb-flex" : "nb-flex"}>
            <Pill segments={w.segments} script={w.script} palette={mark === "done" ? "lime" : "yellow"} size={24} />
          </span>
        ) : (
          <b className="nb-wall-no">{t.num(k + 1)}</b>
        )}
        {!shown && (game === "boxes" || game === "curtain") && <span className="nb-wall-cover" aria-hidden="true" />}
        {isOpen && (game === "boxes" || game === "curtain") && (
          <span className="nb-wall-cover nb-anim-lift" aria-hidden="true" />
        )}
        {mark && (
          <span className="nb-wall-mark" aria-hidden="true">
            <Icon name={mark === "done" ? "check" : "review"} size={18} tone={mark === "done" ? "lime" : "peach"} />
          </span>
        )}
      </button>
    );
  };

  return (
    <GameShell gameKey={game} from={from}>
      <div className="nb-cols">
        <section className="nb-card nb-col-main nb-anim-rise">
          <p className="nb-muted nb-center nb-m0">{t(`games.howTo.${game}`)}</p>
          {game === "cards" ? (
            <Deck
              left={r.deck.length}
              palette={pal}
              canDeal={!r.open && r.deck.length > 0}
              onDeal={() => open(r.deck[0])}
            />
          ) : game === "wheel" ? (
            <Wheel
              board={board}
              marks={r.marks}
              busy={r.open !== null}
              palette={pal}
              turn={r.turn}
              onLand={(id, turn) => setRun({ ...r, open: id, turn })}
            />
          ) : (
            <div className={`nb-wall nb-wall-${game}`}>{board.map(cell)}</div>
          )}
          {current && <Reveal word={current} flip={game === "cards" || game === "wheel"} onGrade={judge} />}
          {finished && !current && (
            <div className="nb-band nb-center nb-anim-pop" role="status" style={pillVars("lime")}>
              <Icon name="crown" size={40} />
              <b>{t("games.finished", { n: t.num(done), total: t.num(board.length) })}</b>
              <button type="button" className="nb-btn nb-btn-ok nb-btn-big" onClick={() => setRound(round + 1)}>
                {t("ladder.again")}
              </button>
            </div>
          )}
        </section>
        <aside className="nb-col-side">
          <RoundPanel
            done={done}
            total={board.length}
            points={r.points}
            tries={r.tries}
            palette={pal}
            extra={
              review > 0 && (
                <div className="nb-spread">
                  <span className="nb-muted">{t("games.toReview")}</span>
                  <b>{t.num(review)}</b>
                </div>
              )
            }
          />
        </aside>
      </div>
    </GameShell>
  );
}

/** The chosen word, large, with the two grading buttons. */
function Reveal({ word, flip, onGrade }: { word: Word; flip: boolean; onGrade: (r: "correct" | "wrong") => void }) {
  const t = useT();
  return (
    <div className={`nb-wall-reveal ${flip ? "nb-anim-flip" : "nb-anim-pop"}`} aria-live="polite">
      <Pill segments={word.segments} script={word.script} palette="yellow" size={40} />
      <div className="nb-row nb-row-btns nb-center">
        <button type="button" className="nb-btn nb-btn-ok nb-btn-big" onClick={() => onGrade("correct")}>
          <Icon name="check" size={24} colours={{ fill: "color.surface", line: "color.surface" }} /> {t("lesson.right")}
        </button>
        <button type="button" className="nb-btn nb-btn-again nb-btn-big" onClick={() => onGrade("wrong")}>
          {t("lesson.again")}
        </button>
      </div>
    </div>
  );
}

/** A face-down pile; dealing turns over its top card. */
function Deck({
  left,
  palette,
  canDeal,
  onDeal,
}: {
  left: number;
  palette: string;
  canDeal: boolean;
  onDeal: () => void;
}) {
  const t = useT();
  return (
    <div className="nb-deck" style={pillVars(palette)}>
      <div className="nb-deck-pile" aria-hidden="true">
        {Array.from({ length: Math.min(left, 4) }, (_, i) => (
          <span key={i} style={{ "--i": i } as React.CSSProperties} />
        ))}
      </div>
      <span className="nb-muted">{t("games.cardsLeft", { n: t.num(left) })}</span>
      <button type="button" className="nb-btn nb-btn-soft" disabled={!canDeal} onClick={onDeal}>
        <Icon name="cards" size={22} tone={palette} /> {t("games.deal")}
      </button>
    </div>
  );
}

/** Wheel of numbered slices, one per word; it always stops on a word not yet read right. */
function Wheel({
  board,
  marks,
  busy,
  palette,
  turn,
  onLand,
}: {
  board: Word[];
  marks: Record<string, Mark>;
  busy: boolean;
  palette: string;
  turn: number;
  onLand: (id: string, turn: number) => void;
}) {
  const t = useT();
  const [spin, setSpin] = useState<{ angle: number; target: string } | null>(null);
  const wheel = useRef<SVGSVGElement>(null);
  const n = board.length;
  const slice = 360 / n;
  const angle = spin?.angle ?? turn;
  const left = board.map((w, i) => ({ w, i })).filter(({ w }) => marks[w.id] !== "done");
  const go = () => {
    if (spin || busy || !left.length) return;
    // A different slice each spin, seeded by where the wheel stopped last (no randomness in render).
    const pick = left[Math.floor(Math.abs(Math.sin(turn * 12.9898 + left.length * 78.233)) * 1e4) % left.length];
    // Clockwise turns, then stop with the chosen slice's middle under the pointer at the top.
    const stop = 360 - (pick.i + 0.5) * slice;
    const next = turn - (turn % 360) + 360 * 5 + stop;
    // With less motion the turn is instant and no transitionend comes, so land straight away.
    const still = wheel.current && parseFloat(getComputedStyle(wheel.current).transitionDuration) === 0;
    if (still) onLand(pick.w.id, next);
    else setSpin({ angle: next, target: pick.w.id });
  };
  const r = 100;
  const point = (deg: number, rad = r) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return `${(r + rad * Math.cos(a)).toFixed(2)} ${(r + rad * Math.sin(a)).toFixed(2)}`;
  };
  return (
    <div className="nb-wheel-box" style={pillVars(palette)}>
      <span className="nb-wheel-pointer" aria-hidden="true" />
      <svg
        ref={wheel}
        viewBox="0 0 200 200"
        className="nb-wheel nb-tr-spin"
        style={{ transform: `rotate(${angle}deg)` }}
        onTransitionEnd={() => {
          if (!spin) return;
          onLand(spin.target, spin.angle);
          setSpin(null);
        }}
        role="img"
        aria-label={t("games.wheelLabel", { n: t.num(left.length) })}
      >
        {board.map((w, i) => {
          const p = PALETTES[i % PALETTES.length];
          const isDone = marks[w.id] === "done";
          return (
            <g key={w.id} className={isDone ? "nb-wheel-done" : undefined}>
              <path
                d={
                  n === 1
                    ? `M ${r} 0 A ${r} ${r} 0 1 1 ${r - 0.01} 0 Z`
                    : `M ${r} ${r} L ${point(i * slice)} A ${r} ${r} 0 ${slice > 180 ? 1 : 0} 1 ${point((i + 1) * slice)} Z`
                }
                style={{
                  fill: `var(--nb-color-pill-${isDone ? "gray" : p}-fill)`,
                  stroke: `var(--nb-color-pill-${isDone ? "gray" : p}-line)`,
                }}
                strokeWidth="1.5"
              />
              <text
                transform={`translate(${point((i + 0.5) * slice, r * 0.68)}) rotate(${(i + 0.5) * slice})`}
                className="nb-wheel-no"
                textAnchor="middle"
                dominantBaseline="central"
              >
                {isDone ? "" : t.num(i + 1)}
              </text>
            </g>
          );
        })}
        <circle cx={r} cy={r} r="16" className="nb-wheel-hub" />
      </svg>
      <button
        type="button"
        className="nb-btn nb-btn-ok nb-btn-big"
        disabled={busy || spin !== null || !left.length}
        onClick={go}
      >
        <Icon name="wheel" size={24} colours={{ fill: "color.surface", line: "color.surface" }} /> {t("games.spin")}
      </button>
    </div>
  );
}
